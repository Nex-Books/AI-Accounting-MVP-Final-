import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  gstin: z.string().max(15).nullable().optional(),
  pan: z.string().max(10).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  business_type: z.string().max(100).nullable().optional(),
  fiscal_year_start: z.enum(['04-01', '01-01']).optional(),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!dbUser?.company_id) {
    return NextResponse.json({ error: 'No company found' }, { status: 404 })
  }

  if (dbUser.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can update company settings' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('companies')
    .update(parsed.data)
    .eq('id', dbUser.company_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ company: data })
}
