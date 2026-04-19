import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { PLAN_LIMITS, type PlanTier } from '@/lib/types'

// Razorpay plan IDs — set these in your Razorpay dashboard and add to env vars
const RAZORPAY_PLAN_IDS: Partial<Record<PlanTier, string>> = {
  essentials: process.env.RAZORPAY_PLAN_ID_ESSENTIALS || '',
  professional: process.env.RAZORPAY_PLAN_ID_PROFESSIONAL || '',
  enterprise: process.env.RAZORPAY_PLAN_ID_ENTERPRISE || '',
}

const subscribeSchema = z.object({
  plan: z.enum(['essentials', 'professional', 'enterprise']),
})

export async function POST(request: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: 'Billing not configured. Please contact support.' },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: dbUser } = await supabase
    .from('users')
    .select('company_id, role, email, full_name')
    .eq('id', user.id)
    .single()

  if (!dbUser?.company_id) {
    return NextResponse.json({ error: 'No company found' }, { status: 404 })
  }
  if (dbUser.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can manage billing' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = subscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { plan } = parsed.data
  const planId = RAZORPAY_PLAN_IDS[plan]

  if (!planId) {
    return NextResponse.json(
      { error: `Razorpay plan ID not configured for "${plan}". Contact support.` },
      { status: 503 }
    )
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  try {
    // Create a Razorpay subscription
    const rzpResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        plan_id: planId,
        total_count: 12, // 12 billing cycles (monthly = 1 year, auto-renews)
        quantity: 1,
        customer_notify: 1,
        notes: {
          company_id: dbUser.company_id,
          plan,
          email: dbUser.email,
        },
      }),
    })

    if (!rzpResponse.ok) {
      const err = await rzpResponse.json()
      return NextResponse.json(
        { error: err.error?.description || 'Failed to create subscription' },
        { status: rzpResponse.status }
      )
    }

    const subscription = await rzpResponse.json()

    // Save the subscription ID on the company so the webhook can find it
    await supabase
      .from('companies')
      .update({ razorpay_subscription_id: subscription.id, plan_status: 'pending' })
      .eq('id', dbUser.company_id)

    return NextResponse.json({
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,
      keyId,
      plan,
      planPrice: PLAN_LIMITS[plan].price,
      planName: PLAN_LIMITS[plan].name,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
