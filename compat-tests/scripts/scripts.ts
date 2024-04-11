/**
 * Utility functions for the compatibility tests
 */

import * as prettier from 'prettier'
import * as path from 'path'
import {globby, argv, YAML, $, fs, cd, os} from '@cspotcode/zx'
import onCleanup from 'node-cleanup'
import startVerdaccioServer from 'verdaccio'
import {defer} from '../utils/testUtils'

/**
 * @param {string} pkg
 * @returns boolean
 */
const isTheatreDependency = (pkg) =>
  pkg.startsWith('@theatre/') || pkg === 'theatric'

const verbose = !!argv['verbose']

if (!verbose) {
  $.verbose = false
  console.log(
    'Running in quiet mode. Add --verbose to see the output of all commands.',
  )
}

const config = {
  VERDACCIO_PORT: 4823,
  VERDACCIO_HOST: `localhost`,
  get VERDACCIO_URL() {
    return `http://${config.VERDACCIO_HOST}:${config.VERDACCIO_PORT}/`
  },
  PATH_TO_COMPAT_TESTS_ROOT: path.join(__dirname, '..'),
  MONOREPO_ROOT: path.join(__dirname, '../..'),
}

/**
 * Set environment variables so that yarn and npm use verdaccio as the registry.
 * These are only set for the current process.
 */
process.env.YARN_NPM_PUBLISH_REGISTRY = config.VERDACCIO_URL
process.env.YARN_UNSAFE_HTTP_WHITELIST = config.VERDACCIO_HOST
process.env.YARN_NPM_AUTH_IDENT = 'test:test'
process.env.NPM_CONFIG_REGISTRY = config.VERDACCIO_URL

const tempVersion =
  '0.0.1-COMPAT.' +
  (typeof argv['version'] === 'number'
    ? argv['version'].toString()
    : // a random integer between 1 and 50000
      (Math.floor(Math.random() * 50000) + 1).toString())

const keepAlive = !!argv['keep-alive']

/**
 * This script starts verdaccio and publishes all the packages in the monorepo to it, then
 * it runs `npm install` on all the test packages, and finally it closes verdaccio.
 */
export async function installFixtures(): Promise<void> {
  onCleanup((exitCode, signal) => {
    onCleanup.uninstall()
    restoreTestPackageJsons()
    process.kill(process.pid, signal)
    return false
  })

  console.log(
    `Using temporary version: ${tempVersion} . Use --version=[NUMBER] to change.`,
  )
  console.log('Patching package.json files in ./test-*')
  const restoreTestPackageJsons = await patchTestPackageJsons()

  console.log('Starting verdaccio')
  const verdaccioServer = await startVerdaccio(config.VERDACCIO_PORT)
  console.log(`Verdaccio is running on ${config.VERDACCIO_URL}`)

  console.log('Releasing @theatre/* packages to verdaccio')
  await releaseToVerdaccio()

  console.log('Running `$ npm install` on test packages')
  await runNpmInstallOnTestPackages()

  restoreTestPackageJsons()

  if (keepAlive) {
    console.log('Keeping verdaccio alive. Press Ctrl+C to exit.')
    // wait for ctrl+c
    await new Promise((resolve) => {})
  } else {
    console.log('Closing verdaccio. Use --keep-alive to keep it running.')
    await verdaccioServer.close()
  }
  console.log('Done')
}

async function runNpmInstallOnTestPackages() {
  const packagePaths = await getCompatibilityTestSetups()

  const promises = packagePaths.map(async (pathToPackageDir) => {
    await fs.remove(path.join(pathToPackageDir, 'node_modules'))
    await fs.remove(path.join(pathToPackageDir, 'package-lock.json'))
    cd(path.join(pathToPackageDir, '../'))
    const tempPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'theatre-compat-test-'),
    )
    await fs.copy(pathToPackageDir, tempPath)

    cd(path.join(tempPath))
    try {
      console.log('Running npm install on ' + pathToPackageDir + '...')
      await $`npm install --registry ${config.VERDACCIO_URL} --loglevel ${
        verbose ? 'warn' : 'error'
      } --fund false`

      console.log('npm install finished successfully in' + tempPath)

      await fs.move(
        path.join(tempPath, 'node_modules'),
        path.join(pathToPackageDir, 'node_modules'),
      )
      await fs.move(
        path.join(tempPath, 'package-lock.json'),
        path.join(pathToPackageDir, 'package-lock.json'),
      )
    } catch (error) {
      console.error(`Failed to install dependencies for ${pathToPackageDir}
Try running \`npm install\` in that directory manually via:
cd ${pathToPackageDir}
npm install --registry ${config.VERDACCIO_URL}
Original error: ${error}`)
      throw new Error(`Failed to install dependencies for ${pathToPackageDir}`)
    } finally {
      await fs.remove(tempPath)
    }
  })

  const result = await Promise.allSettled(promises)
  const failed = result.filter((x) => x.status === 'rejected')
  if (failed.length > 0) {
    console.error(
      `Failed to install dependencies for the following packages:`,
      result
        .map((result, i) => [packagePaths[i], result])
        .filter(
          ([p, result]) =>
            // @ts-ignore
            result.status === 'rejected',
        )
        .map(([path]) => path),
    )
  }
}

/**
 * Takes an absolute path to a package.json file and replaces all of its
 * dependencies on `@theatre/*` packatges to `version`.
 *
 * @param {string} pathToPackageJson absolute path to the package.json file
 * @param {string} version The version to set all `@theatre/*` dependencies to
 */
async function patchTheatreDependencies(pathToPackageJson, version) {
  const originalFileContent = fs.readFileSync(pathToPackageJson, {
    encoding: 'utf-8',
  })
  // get the package.json file's content
  const packageJson = JSON.parse(originalFileContent)

  // find all dependencies on '@theatre/*' packages and replace them with the local version
  for (const dependencyType of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
  ]) {
    const dependencies = packageJson[dependencyType]
    if (dependencies) {
      for (const dependencyName of Object.keys(dependencies)) {
        if (isTheatreDependency(dependencyName)) {
          dependencies[dependencyName] = version
        }
      }
    }
  }
  // run the json through prettier
  const jsonStringPrettified = await prettier.format(
    JSON.stringify(packageJson, null, 2),
    {
      parser: 'json',
      filepath: pathToPackageJson,
    },
  )

  // write the modified package.json file
  fs.writeFileSync(pathToPackageJson, jsonStringPrettified, {encoding: 'utf-8'})
}

async function patchTestPackageJsons(): Promise<() => void> {
  const packagePaths = (await getCompatibilityTestSetups()).map(
    (pathToPackageDir) => path.join(pathToPackageDir, 'package.json'),
  )

  // replace all dependencies on @theatre/* packages with the local version
  for (const pathToPackageJson of packagePaths) {
    patchTheatreDependencies(pathToPackageJson, tempVersion)
  }

  return () => {
    // replace all dependencies on @theatre/* packages with the 0.0.1-COMPAT.1
    for (const pathToPackageJson of packagePaths) {
      patchTheatreDependencies(pathToPackageJson, '0.0.1-COMPAT.1')
    }
  }
}

/**
 * Starts the verdaccio server and returns a promise that resolves when the serve is up and ready
 *
 * Credit: https://github.com/storybookjs/storybook/blob/92b23c080d03433765cbc7a60553d036a612a501/scripts/run-registry.ts
 */
async function startVerdaccio(port: number): Promise<{close: () => void}> {
  let resolved = false

  const deferred = defer<{close: () => void}>()

  const config = {
    ...YAML.parse(
      fs.readFileSync(path.join(__dirname, '../verdaccio.yml'), 'utf8'),
    ),
  }

  if (verbose) {
    config.logs.level = 'warn'
  }

  const cache = path.join(__dirname, '../.verdaccio-cache')

  config.self_path = cache

  startVerdaccioServer(
    config,
    '6000',
    cache,
    '1.0.0',
    'verdaccio',
    (webServer) => {
      webServer.listen(port, () => {
        resolved = true
        deferred.resolve(webServer)
      })
    },
  )

  await Promise.race([
    deferred.promise,
    new Promise((_, rej) => {
      setTimeout(() => {
        rej(new Error(`TIMEOUT - verdaccio didn't start within 10s`))
      }, 10000)
    }),
  ])

  return deferred.promise
}

const packagesToPublish = [
  '@theatre/core',
  '@theatre/studio',
  '@theatre/dataverse',
  '@theatre/react',
  '@theatre/browser-bundles',
  '@theatre/r3f',
  'theatric',
]

/**
 * Assigns a new version to each of @theatre/* packages. If there a package depends on another package in this monorepo,
 * this function makes sure the dependency version is fixed at "version"
 *
 * @param workspacesListObjects - An Array of objects containing information about the workspaces
 * @param version - Version of the latest commit (or any other string)
 * @returns - An async function that restores the package.json files to their original version
 */
async function writeVersionsToPackageJSONs(
  workspacesListObjects: Array<{name: string; location: string}>,
  version: string,
): Promise<() => void> {
  /**
   * An array of functions each of which restores a certain package.json to its original state
   * @type {Array<() => void>}
   */
  const restores = []
  for (const workspaceData of workspacesListObjects) {
    const pathToPackage = path.resolve(
      config.MONOREPO_ROOT,
      workspaceData.location,
      './package.json',
    )

    const originalFileContent = fs.readFileSync(pathToPackage, {
      encoding: 'utf-8',
    })
    const originalJson = JSON.parse(originalFileContent)

    restores.push(() => {
      fs.writeFileSync(pathToPackage, originalFileContent, {encoding: 'utf-8'})
    })

    let {dependencies, peerDependencies, devDependencies} = originalJson

    // Normally we don't have to override the package versions in dependencies because yarn would already convert
    // all the "workspace:*" versions to a fixed version before publishing. However, packages like @theatre/studio
    // have a peerDependency on @theatre/core set to "*" (meaning they would work with any version of @theatre/core).
    // This is not the desired behavior in pre-release versions, so here, we'll fix those "*" versions to the set version.
    for (const deps of [dependencies, peerDependencies, devDependencies]) {
      if (!deps) continue
      for (const wpObject of workspacesListObjects) {
        if (deps[wpObject.name]) {
          deps[wpObject.name] = version
        }
      }
    }
    const newJson = {
      ...originalJson,
      version,
      dependencies,
      peerDependencies,
      devDependencies,
    }
    fs.writeFileSync(pathToPackage, JSON.stringify(newJson, undefined, 2), {
      encoding: 'utf-8',
    })
  }
  return () =>
    restores.forEach((fn) => {
      fn()
    })
}

/**
 * Builds all the @theatre/* packages with version number 0.0.1-COMPAT.1 and publishes
 * them all to the verdaccio registry
 */
async function releaseToVerdaccio() {
  cd(config.MONOREPO_ROOT)

  // @ts-ignore ignore
  process.env.THEATRE_IS_PUBLISHING = true

  const workspacesListString = await $`yarn workspaces list --json`
  const workspacesListObjects = workspacesListString.stdout
    .split(os.EOL)
    // strip out empty lines
    .filter(Boolean)
    .map((x) => JSON.parse(x))

  const restorePackages = await writeVersionsToPackageJSONs(
    workspacesListObjects,
    tempVersion,
  )

  // Restore the package.json files to their original state when the process is killed
  process.on('SIGINT', async function cleanup(a) {
    restorePackages()
  })

  try {
    await $`yarn cli build clean`
    await $`yarn cli build`

    await Promise.all(
      packagesToPublish.map(async (workspaceName) => {
        const npmTag = 'compat'
        await $`yarn workspace ${workspaceName} npm publish --access public --tag ${npmTag}`
      }),
    )
  } finally {
    restorePackages()
  }
}

/**
 * Get all the setups from `./compat-tests/`
 *
 * @returns An array containing the absolute paths to the compatibility test setups
 */
export async function getCompatibilityTestSetups(): Promise<Array<string>> {
  const fixturePackageJsonFiles = await globby(
    './fixtures/*/package/package.json',
    {
      cwd: config.PATH_TO_COMPAT_TESTS_ROOT,
      gitignore: false,
      onlyFiles: true,
    },
  )

  return fixturePackageJsonFiles.map((entry) => {
    return path.join(config.PATH_TO_COMPAT_TESTS_ROOT, entry, '../')
  })
}

/**
 * Deletes ../test-*\/(node_modules|package-lock.json|yarn.lock)
 */
export async function clean() {
  const toDelete = await globby(
    './fixtures/*/package/(node_modules|yarn.lock|package-lock.json|.parcel-cache)',
    {
      cwd: config.PATH_TO_COMPAT_TESTS_ROOT,
      // node_modules et al are gitignored, but we still want to clean them
      gitignore: false,
      // include directories too
      onlyFiles: false,
    },
  )

  return await Promise.all(
    toDelete.map((fileOrDir) => {
      console.log('deleting', fileOrDir)
      return fs.remove(path.join(config.PATH_TO_COMPAT_TESTS_ROOT, fileOrDir))
    }),
  )
}
