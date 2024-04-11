import {test, expect} from '@playwright/test'

test.describe('hot-reload-extension-toolbar', () => {
  test('works', async ({page}) => {
    await page.goto('./tests/hot-reload-extension-toolbar/')

    const toolbar = page.locator(
      '[data-testid="theatre-extensionToolbar-global"]',
    )

    const forwardButton = toolbar.getByRole('button', {name: '>'})
    await forwardButton.click()

    const otherButton = toolbar.getByRole('button').nth(1)

    expect(await otherButton.textContent()).toEqual('1')

    await forwardButton.click()
    expect(await otherButton.textContent()).toEqual('2')
    await forwardButton.click()

    // expect otherButton not to exist
    await expect(otherButton).not.toBeAttached()
  })
})
