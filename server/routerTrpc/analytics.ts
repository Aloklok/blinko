import { z } from "zod"
import dayjs from "@shared/lib/dayjs"
import { router, authProcedure } from "../middleware"
import { prisma } from "../prisma"
import { dailyNoteCount, monthlyWordStats } from "@server/generated/client/sql"

export const analyticsRouter = router({
  dailyNoteCount: authProcedure
    .meta({ openapi: { method: 'POST', path: '/v1/analytics/daily-note-count', summary: 'Query daily note count', protect: true, tags: ['Analytics'] } })
    .input(z.void())
    .output(z.array(z.object({
      date: z.string(),
      count: z.number()
    })))
    .mutation(async function ({ ctx }) {
      const dailyStats = await prisma.$queryRawTyped(dailyNoteCount(Number(ctx.id)));

      return dailyStats.map(stat => ({
        date: stat.date!,
        count: Number(stat.count)
      }));
    }),

  monthlyStats: authProcedure
    .meta({ openapi: { method: 'POST', path: '/v1/analytics/monthly-stats', summary: 'Query monthly statistics', protect: true, tags: ['Analytics'] } })
    .input(z.object({
      month: z.string()
    }))
    .output(z.object({
      noteCount: z.number(),
      totalWords: z.number(),
      maxDailyWords: z.number(),
      activeDays: z.number(),
      tagStats: z.array(z.object({
        tagName: z.string(),
        count: z.number()
      })).optional()
    }))
    .mutation(async function ({ ctx, input }) {
      const accountId = Number(ctx.id);
      const startDate = dayjs(input.month).startOf('month').toDate()
      const endDate = dayjs(input.month).endOf('month').toDate()

      const noteCount = await prisma.notes.count({
        where: {
          accountId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      })

      const wordStats = await prisma.$queryRawTyped(monthlyWordStats(accountId, startDate));

      const totalWords = wordStats.reduce((sum, stat) => sum + Number(stat.count || 0), 0)
      const maxDailyWords = wordStats.length > 0 ? Number(wordStats[0]!.count || 0) : 0
      const activeDays = wordStats.length

      const tagStats = await prisma.tag.findMany({
        where: {
          accountId,
          tagsToNote: {
            some: {
              note: {
                accountId
              }
            }
          }
        },
        select: {
          name: true,
          _count: {
            select: {
              tagsToNote: true
            }
          }
        },
        orderBy: {
          tagsToNote: {
            _count: 'desc'
          }
        }
      })

      const validTags = tagStats.filter(tag => tag._count.tagsToNote > 0)
      const TOP_TAG_COUNT = 10
      const topTags = validTags.slice(0, TOP_TAG_COUNT)

      const otherTagsCount = validTags.slice(TOP_TAG_COUNT).reduce((sum, tag) => sum + tag._count.tagsToNote, 0)

      const finalTagStats = [
        ...topTags.map(tag => ({
          tagName: tag.name,
          count: tag._count.tagsToNote
        }))
      ]

      if (otherTagsCount > 0) {
        finalTagStats.push({
          tagName: 'Others',
          count: otherTagsCount
        })
      }

      return {
        noteCount,
        totalWords,
        maxDailyWords,
        activeDays,
        tagStats: finalTagStats
      }
    })
})