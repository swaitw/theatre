import {z} from 'zod'
import {nanoid} from 'nanoid'
import type {AccessTokenPayload} from 'src/utils/authUtils'
import {studioAuth} from 'src/utils/authUtils'
import {v4} from 'uuid'
import * as t from '../trpc'
import prisma from 'src/prisma'

export const userCodeLength = 8
export const FLOW_CHECK_INTERVAL = 5000

export const studioAuthRouter = t.createRouter({
  getPreAuthenticationToken: t.publicProcedure
    .input(
      z.object({
        clientFlowToken: z
          .string()
          .length(36)
          .describe(
            `This is a random string that should be unique for each client flow. It is generated by the client, and will be returned to the client in the \`preAuthenticationToken\` so that the client can match the \`preAuthenticationToken\` to the original client flow.`,
          ),
      }),
    )
    .output(
      z.object({
        interval: z
          .number()
          .int()
          .min(5000)
          .describe(
            'If 5000, it means the library should check the `urlToGetTokens` every 5000ms or longer.',
          ),
        userAuthUrl: z
          .string()
          .url()
          .describe(
            `The URL that the user should be redirected to (or the url to be open via popup) ` +
              `for the user to log in. Note that if the user is already logged ` +
              `into the app, they won't be prompted to log in again.`,
          ),
        preAuthenticationToken: z
          .string()
          .min(72)
          .describe(
            `A unique token that should be passed to $.getTokensFromPreAuthenticationToken()`,
          ),
      }),
    )
    .mutation(async (opts) => {
      const userCode = nanoid(userCodeLength)
      const preAuthenticationToken = v4() + v4()

      await prisma.libAuthenticationFlow.create({
        data: {
          clientFlowToken: opts.input.clientFlowToken,
          createdAt: new Date().toISOString(),
          lastCheckTime: new Date().toISOString(),
          preAuthenticationToken,
          tokens: '',
          userCode: userCode,
          state: 'initialized',
        },
      })

      return {
        interval: FLOW_CHECK_INTERVAL,
        userAuthUrl:
          process.env.NEXT_PUBLIC_WEBAPP_URL +
          `/api/studio-auth?userCode=${userCode}`,
        preAuthenticationToken,
      }
    }),
  getTokensFromPreAuthenticationToken: t.publicProcedure
    .input(
      z.object({
        preAuthenticationToken: z
          .string()
          .describe(
            `The \`preAuthenticationToken\` returned by libAuthentication.getPreAuthenticationToken()`,
          ),
      }),
    )
    .output(
      z.union([
        z.object({
          isError: z.literal(true),
          error: z.enum([
            'invalidPreAuthenticationToken',
            'userDeniedLogin',
            'slowDown',
            'notYetReady',
          ]),
          errorMessage: z.string(),
        }),
        z.object({
          isError: z.literal(false),
          accessToken: z.string(),
          refreshToken: z.string(),
          clientFlowToken: z
            .string()
            .describe(
              `The clientFlowToken passed to libAuthentication.getPreAuthenticationToken()`,
            ),
        }),
      ]),
    )
    .mutation(async ({input}) => {
      const flow = await prisma.libAuthenticationFlow.findFirst({
        where: {preAuthenticationToken: input.preAuthenticationToken},
      })
      if (!flow) {
        return {
          isError: true,
          error: 'invalidPreAuthenticationToken',
          errorMessage:
            'The preAutenticationToken is invalid. It may also have been expired, or already used.',
        }
      }
      await prisma.libAuthenticationFlow.update({
        where: {preAuthenticationToken: input.preAuthenticationToken},
        data: {lastCheckTime: new Date().toISOString()},
      })
      // if flow.lastCheckTime is more recent than 5 seconds ago, return the same thing as last time
      if (
        new Date(flow.lastCheckTime).getTime() >
        Date.now() - FLOW_CHECK_INTERVAL
      ) {
        return {
          isError: true,
          error: 'slowDown',
          errorMessage: 'You are checking too often. Slow down.',
        }
      }

      switch (flow.state) {
        case 'initialized':
          return {
            isError: true,
            error: 'notYetReady',
            errorMessage: `The user hasn't decided to grant/deny access yet.`,
          }
          break
        case 'userDeniedAuth':
          return {
            isError: true,
            error: 'userDeniedLogin',
            errorMessage: `The user denied access.`,
          }
          break
        case 'userAllowedAuth':
          const tokens = JSON.parse(flow.tokens)

          await prisma.libAuthenticationFlow.update({
            where: {preAuthenticationToken: input.preAuthenticationToken},
            data: {state: 'tokenAlreadyUsed'},
          })

          return {
            isError: false,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            clientFlowToken: flow.clientFlowToken,
          }
        // otherwise
        default:
          console.error('Invalid state', flow.state)
          return {
            isError: true,
            error: 'invalidPreAuthenticationToken',
            errorMessage:
              'The preAutenticationToken is invalid. It may also have been expired, or already used.',
          }
      }
    }),
  invalidateRefreshToken: t.publicProcedure
    .input(
      z.object({
        refreshToken: z.string(),
      }),
    )
    .output(
      z.union([
        z.object({
          isError: z.literal(true),
          error: z.enum(['unknown']),
          errorMessage: z.string(),
        }),
        z.object({
          isError: z.literal(false),
        }),
      ]),
    )
    .mutation(async ({input}) => {
      try {
        await studioAuth.destroySession(input.refreshToken)
        return {isError: false}
      } catch (err) {
        console.error(err)
        return {
          isError: true,
          error: 'unknown',
          errorMessage: `An unknown error occured.`,
        }
      }
    }),
  refreshAccessToken: t.publicProcedure
    .input(
      z.object({
        refreshToken: z.string(),
      }),
    )
    .output(
      z.union([
        z.object({
          isError: z.literal(true),
          error: z.enum(['invalidRefreshToken', 'unknown']),
          errorMessage: z.string(),
        }),
        z.object({
          isError: z.literal(false),
          accessToken: z.string(),
          refreshToken: z
            .string()
            .describe(
              `The new refresh token. The old refresh token is now invalid.`,
            ),
        }),
      ]),
    )
    .mutation(async ({input}) => {
      try {
        const {accessToken, refreshToken} = await studioAuth.refreshSession(
          input.refreshToken,
        )
        return {isError: false, accessToken, refreshToken}
      } catch (err: any) {
        console.error(err)
        if (err.message === 'Invalid refresh token') {
          return {
            isError: true,
            error: 'invalidRefreshToken',
            errorMessage: `The refresh token is invalid.`,
          }
        } else {
          return {
            isError: true,
            error: 'unknown',
            errorMessage: `An unknown error occured.`,
          }
        }
      }
    }),

  canIEditProject: t.publicProcedure
    .input(
      z.object({
        studioAuth: studioAuth.input,
        projectId: z.string(),
      }),
    )
    .output(
      z.union([
        z.object({canEdit: z.literal(true)}),
        z.object({
          canEdit: z.literal(false),
          reason: z.enum(['AccessTokenInvalid', 'UserHasNoAccess', 'Unknown']),
        }),
      ]),
    )
    .query(async (opts) => {
      let payload!: AccessTokenPayload
      try {
        payload = await studioAuth.verifyStudioAccessTokenOrThrow(opts)
      } catch (err) {
        return {canEdit: false, reason: 'AccessTokenInvalid'}
      }
      const {userId} = payload
      const proj = await prisma.project.findFirst({
        where: {
          userId,
          id: opts.input.projectId,
        },
      })
      if (proj) {
        return {canEdit: true}
      } else {
        return {canEdit: false, reason: 'UserHasNoAccess'}
      }
    }),
})