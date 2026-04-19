import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sparkles,
  BookOpen,
  Shield,
  BarChart3,
  FileText,
  Users,
  Brain,
  Zap,
  IndianRupee,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Features',
  description: 'Explore NexBooks features — AI-powered accounting for Indian businesses',
}

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Journal Entries',
    description:
      'Just type "paid rent ₹25,000" and the AI instantly creates a correctly balanced double-entry journal with the right accounts.',
    points: ['Natural language input', 'Auto account selection', 'Instant balancing'],
  },
  {
    icon: BookOpen,
    title: 'Double-Entry Bookkeeping',
    description:
      'Full double-entry accounting with automated validation. Every entry must balance — debits always equal credits.',
    points: ['Debit/credit validation', 'Multi-line entries', 'Audit trail'],
  },
  {
    icon: Shield,
    title: 'GST Compliant',
    description:
      'Built from the ground up for Indian GST compliance. CGST, SGST, IGST split calculations and pre-seeded tax accounts.',
    points: ['5%, 12%, 18%, 28% rates', 'CGST + SGST or IGST', 'Tax account tracking'],
  },
  {
    icon: BarChart3,
    title: 'Financial Reports',
    description:
      'One-click reports covering Trial Balance, Balance Sheet, Profit & Loss, and AR/AP Aging in Indian format.',
    points: ['Trial balance', 'P&L and Balance Sheet', 'Aging reports'],
  },
  {
    icon: FileText,
    title: 'Document OCR',
    description:
      'Upload invoices, bills, or bank statements. AI extracts vendor, amount, date, and line items — then creates journal entries automatically.',
    points: ['Excel & CSV import', 'PDF processing', 'Image OCR'],
  },
  {
    icon: IndianRupee,
    title: 'Indian Accounting Standards',
    description:
      'Pre-seeded chart of accounts following Indian standards. Lakhs and crores formatting. April–March fiscal year by default.',
    points: ['50+ standard accounts', 'Lakhs/crores display', 'Ind AS aligned'],
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description:
      'Invite your accountant or team members with role-based access control. Owner, Accountant, and Viewer roles.',
    points: ['Role-based access', 'Multi-user support', 'Activity audit log'],
  },
  {
    icon: Zap,
    title: 'Smart AI Assistant',
    description:
      'Ask any accounting question, get balance summaries, search past transactions, or calculate GST — all in one chat interface.',
    points: ['Natural language queries', 'Real-time balances', 'GST calculator'],
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">NexBooks</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Everything you need to manage your books
          </h1>
          <p className="text-xl text-muted-foreground">
            NexBooks combines AI intelligence with professional accounting tools —
            built specifically for Indian SMBs.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-24">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Start using NexBooks today</h2>
          <p className="text-muted-foreground mb-6">
            Free plan available. No credit card required.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/auth/sign-up">
              <Button size="lg" className="gap-2">
                <Sparkles className="w-5 h-5" />
                Get Started Free
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">View Pricing</Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t mt-24 py-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} NexBooks. All rights reserved.</p>
          <p className="mt-1">
            <a href="mailto:connect@nexbooks.co.in" className="hover:text-foreground">
              connect@nexbooks.co.in
            </a>
            {' · '}
            <a href="https://www.nexbooks.co.in" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              www.nexbooks.co.in
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
