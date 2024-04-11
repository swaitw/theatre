import {z} from 'zod'
import * as t from '../trpc'
import prisma from 'src/prisma'
import {TRPCError} from '@trpc/server'

export const teamsRouter = t.createRouter({
  get: t.protectedProcedure
    .input(z.object({id: z.string()}))
    .output(
      z
        .object({
          id: z.string(),
          name: z.string(),
          members: z.array(
            z.object({
              id: z.string(),
              name: z.string().nullable(),
              email: z.string().nullable(),
              role: z.string(),
            }),
          ),
          workspaces: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              description: z.string(),
            }),
          ),
        })
        .strict(),
    )
    .query(async ({ctx, input}) => {
      const {id} = input
      const {session} = ctx
      const userId = session.user.id

      const team = await prisma.team.findFirst({
        where: {
          id,
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          workspaces: true,
        },
      })

      if (!team) {
        throw new TRPCError({code: 'NOT_FOUND'})
      }

      const clientData = {
        id: team.id,
        name: team.name,
        members: team.members.map((member) => {
          return {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
            role: member.userRole,
          }
        }),
        workspaces: team.workspaces.map((workspace) => {
          return {
            id: workspace.id,
            name: workspace.name,
            description: workspace.description,
          }
        }),
      }

      return clientData
    }),
  getAll: t.protectedProcedure
    .output(
      z.array(
        z
          .object({
            id: z.string(),
            name: z.string(),
            members: z.array(
              z.object({
                id: z.string(),
                name: z.string().nullable(),
                email: z.string().nullable(),
                role: z.string(),
                accepted: z.boolean(),
              }),
            ),
            workspaces: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                description: z.string(),
              }),
            ),
          })
          .strict(),
      ),
    )
    .query(async ({ctx, input}) => {
      const {session} = ctx
      const userId = session.user.id

      const teams = await prisma.team.findMany({
        where: {
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          workspaces: true,
        },
      })

      const clientData = teams.map((team) => {
        return {
          id: team.id,
          name: team.name,
          members: team.members.map((member) => {
            return {
              id: member.user.id,
              name: member.user.name,
              email: member.user.email,
              role: member.userRole,
              accepted: member.accepted,
            }
          }),
          workspaces: team.workspaces.map((workspace) => {
            return {
              id: workspace.id,
              name: workspace.name,
              description: workspace.description,
            }
          }),
        }
      })

      return clientData
    }),
  create: t.protectedProcedure
    .input(
      z.object({
        name: z.string(),
      }),
    )
    .output(z.object({id: z.string()}).strict())
    .mutation(async ({ctx, input}) => {
      const {name} = input
      const {session} = ctx
      const userId = session.user.id

      const team = await prisma.team.create({
        data: {
          name,
          members: {
            create: {
              user: {
                connect: {
                  id: userId,
                },
              },
              userRole: 'OWNER',
              accepted: true,
            },
          },
        },
      })

      return {id: team.id}
    }),
  update: t.protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
      }),
    )
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const {id, name} = input
      const {session} = ctx
      const userId = session.user.id

      const team = await prisma.team.findUnique({
        where: {
          id,
        },
        select: {
          members: {
            where: {
              userId,
            },
          },
        },
      })

      // Only team owners are allowed to update teams
      const updateAllowed = team?.members[0]?.userRole === 'OWNER'

      if (!updateAllowed) {
        throw new TRPCError({code: 'FORBIDDEN'})
      }

      const newTeam = await prisma.team.update({
        where: {
          id,
        },
        data: {
          name,
        },
      })

      return {
        id: newTeam.id,
        name: newTeam.name,
      }
    }),
  delete: t.protectedProcedure
    .input(z.object({id: z.string(), safety: z.string()}))
    .mutation(async ({ctx, input}) => {
      const {id, safety} = input
      const {session} = ctx
      const userId = session.user.id

      const team = await prisma.team.findUnique({
        where: {
          id,
        },
        select: {
          name: true,
          members: {
            where: {
              userId,
            },
          },
        },
      })

      if (safety !== `delete ${team?.name}`) {
        throw new TRPCError({code: 'BAD_REQUEST'})
      }

      // Only team owners are allowed to delete teams
      const deleteAllowed = team?.members[0]?.userRole === 'OWNER'

      if (!deleteAllowed) {
        throw new TRPCError({code: 'FORBIDDEN'})
      }

      await prisma.team.delete({
        where: {
          id,
        },
      })
    }),
  inviteMembers: t.protectedProcedure
    .input(
      z.object({
        id: z.string(),
        invites: z.array(
          z.object({
            email: z.string().email(),
            role: z.enum(['OWNER', 'MEMBER']),
          }),
        ),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const {id, invites} = input
      const emails = invites.map((invites) => invites.email)
      const {session} = ctx
      const userId = session.user.id

      const team = await prisma.team.findUnique({
        where: {
          id,
        },
        select: {
          members: {
            where: {
              userId,
            },
          },
        },
      })

      // Make sure users exist
      const invitedUsers = await prisma.user.findMany({
        where: {
          email: {
            in: emails,
          },
        },
      })

      if (invitedUsers.length !== emails.length) {
        throw new TRPCError({code: 'BAD_REQUEST'})
      }

      // Only team owners are allowed to invite members
      const inviteAllowed = team?.members[0]?.userRole === 'OWNER'

      if (!inviteAllowed) {
        throw new TRPCError({code: 'FORBIDDEN'})
      }

      await prisma.team.update({
        where: {
          id,
        },
        data: {
          members: {
            upsert: invites.map((invite) => {
              const invitedUser = invitedUsers.find(
                (user) => user.email === invite.email,
              )!

              return {
                where: {
                  userId_teamId: {
                    userId: invitedUser.id,
                    teamId: id,
                  },
                },
                create: {
                  user: {
                    connect: {
                      id: invitedUser.id,
                    },
                  },
                  userRole: invite.role,
                },
                update: {},
              }
            }),
          },
        },
      })
    }),
  removeMember: t.protectedProcedure
    .input(z.object({id: z.string(), email: z.string()}))
    .mutation(async ({ctx, input}) => {
      const {id, email} = input
      const {session} = ctx
      const currentUserId = session.user.id

      const team = await prisma.team.findUnique({
        where: {
          id,
        },
        select: {
          members: {
            where: {
              userId: currentUserId,
            },
            include: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      })

      // Only team owners are allowed to remove members, or the member themselves
      const removeAllowed =
        team?.members[0]?.userRole === 'OWNER' ||
        team?.members[0]?.user.email === email

      if (!removeAllowed) {
        throw new TRPCError({code: 'FORBIDDEN'})
      }

      const userToRemove = await prisma.user.findUnique({
        where: {
          email,
        },
      })

      await prisma.team.update({
        where: {
          id,
        },
        data: {
          members: {
            delete: {
              userId_teamId: {
                userId: userToRemove?.id!,
                teamId: id,
              },
            },
          },
        },
      })
    }),
  changeMemberRole: t.protectedProcedure
    .input(
      z.object({
        id: z.string(),
        email: z.string(),
        role: z.enum(['OWNER', 'MEMBER']),
      }),
    )
    .mutation(async ({ctx, input}) => {
      const {id, email, role} = input
      const {session} = ctx
      const currentUserId = session.user.id

      const team = await prisma.team.findUnique({
        where: {
          id,
        },
        select: {
          members: {
            where: {
              userId: currentUserId,
            },
            include: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      })

      // Only team owners are allowed to change member roles and a team owner cannot demote themselves
      const changeAllowed =
        team?.members[0]?.userRole === 'OWNER' &&
        email !== team?.members[0]?.user.email

      if (!changeAllowed) {
        throw new TRPCError({code: 'FORBIDDEN'})
      }

      const userToChange = await prisma.user.findUnique({
        where: {
          email,
        },
      })

      await prisma.team.update({
        where: {
          id,
        },
        data: {
          members: {
            update: {
              where: {
                userId_teamId: {
                  userId: userToChange?.id!,
                  teamId: id,
                },
              },
              data: {
                userRole: role,
              },
            },
          },
        },
      })
    }),
  acceptInvite: t.protectedProcedure
    .input(z.object({id: z.string()}))
    .mutation(async ({ctx, input}) => {
      const {id} = input
      const {session} = ctx
      const userId = session.user.id

      const team = await prisma.team.findUnique({
        where: {
          id,
        },
        select: {
          members: {
            where: {
              userId,
            },
          },
        },
      })

      // Only team members are allowed to accept invites
      const acceptAllowed = team?.members.length !== 0

      console.log(acceptAllowed)

      if (!acceptAllowed) {
        throw new TRPCError({code: 'FORBIDDEN'})
      }

      await prisma.teamMember.update({
        where: {
          userId_teamId: {
            userId,
            teamId: id,
          },
        },
        data: {
          accepted: true,
        },
      })
    }),
  getMembers: t.protectedProcedure
    .input(z.object({id: z.string()}))
    .output(
      z.array(
        z.object({
          email: z.string(),
          name: z.string().nullable(),
          image: z.string().nullable(),
          role: z.enum(['OWNER', 'MEMBER']),
          accepted: z.boolean(),
        }),
      ),
    )
    .query(async ({ctx, input}) => {
      const {id} = input
      const {session} = ctx
      const userId = session.user.id

      const team = await prisma.team.findFirst({
        where: {
          id,
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  email: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      })

      if (!team) {
        throw new TRPCError({code: 'NOT_FOUND'})
      }

      const clientData = team.members.map((member) => {
        return {
          email: member.user.email!,
          name: member.accepted ? member.user.name : null,
          image: member.accepted ? member.user.image : null,
          role: member.userRole,
          accepted: member.accepted,
        }
      })

      return clientData
    }),
})
