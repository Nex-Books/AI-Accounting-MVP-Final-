import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Target, Heart, Zap } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'About NexBooks',
  description: 'Learn about NexBooks — AI-powered accounting for Indian small businesses',
}

export default function AboutPage() {
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

      <main className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Accounting that works for <span className="text-accent">Indian businesses</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            NexBooks was built with one goal: make professional accounting accessible
            to every Indian small business — without the complexity.
          </p>
        </div>

        {/* Mission */}
        <div className="prose prose-lg dark:prose-invert mx-auto mb-16">
          <h2>Our Mission</h2>
          <p>
            80% of Indian SMBs avoid accounting software because it&apos;s too complex
            and time-consuming. They end up with disorganised books, missed GST filings,
            and poor financial visibility.
          </p>
          <p>
            NexBooks removes the complexity entirely. Instead of learning accounting
            software, you just type what happened — &ldquo;paid rent ₹25,000&rdquo; — and the AI
            creates the correct double-entry journal entry, picks the right accounts,
            and keeps your books in order.
          </p>
          <p>
            We believe every small business deserves a great accountant. NexBooks is
            that accountant — available 24/7, fully GST-compliant, and costing a
            fraction of hiring a human.
          </p>
        </div>

        {/* Values */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold mb-2">India-First</h3>
              <p className="text-sm text-muted-foreground">
                Built for Indian accounting standards, GST compliance, and the April–March
                fiscal year from day one.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold mb-2">Simplicity First</h3>
              <p className="text-sm text-muted-foreground">
                If your accountant can understand it in plain English, NexBooks can
                record it. No training required.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Heart className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold mb-2">Built with Care</h3>
              <p className="text-sm text-muted-foreground">
                Every feature is designed around real SMB workflows — not enterprise
                complexity ported down.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Contact */}
        <div className="text-center p-8 rounded-2xl bg-muted/50 border">
          <h2 className="text-2xl font-bold mb-3">Get in touch</h2>
          <p className="text-muted-foreground mb-4">
            Questions, feedback, or partnership enquiries — we&apos;re always happy to chat.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 text-sm">
            <a href="mailto:connect@nexbooks.co.in" className="text-accent hover:underline font-medium">
              connect@nexbooks.co.in
            </a>
            <span className="hidden sm:inline text-muted-foreground">·</span>
            <a href="https://www.nexbooks.co.in" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">
              www.nexbooks.co.in
            </a>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Link href="/auth/sign-up">
            <Button size="lg" className="gap-2">
              <Sparkles className="w-5 h-5" />
              Start Free Today
            </Button>
          </Link>
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
