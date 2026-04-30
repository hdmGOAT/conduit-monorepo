import { z } from 'zod'

export const privacySchema = z.enum(['public', 'private'])

export const groupFormSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters').max(80, 'Name must be 80 characters or less'),
  privacy: privacySchema,
})

export type GroupFormInput = z.infer<typeof groupFormSchema>
