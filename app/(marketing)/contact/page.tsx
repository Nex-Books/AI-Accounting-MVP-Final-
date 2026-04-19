import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Mail, Globe, Clock } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the NexBooks team',
}

export default function ContactPage() {
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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-muted-foreground">
            Have questions? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-2">
                <Mail className="w-6 h-6 text-accent" />
              </div>
              <CardTitle className="text-lg">Email</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Send us an email and we&apos;ll get back to you within 24 hours.
              </p>
              <a
                href="mailto:connect@nexbooks.co.in"
                className="text-accent hover:underline font-medium text-sm"
              >
                connect@nexbooks.co.in
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-2">
                <Globe className="w-6 h-6 text-accent" />
              </div>
              <CardTitle className="text-lg">Website</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Visit our website for more information about NexBooks.
              </p>
              <a
                href="https://www.nexbooks.co.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline font-medium text-sm"
              >
                www.nexbooks.co.in
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-2">
                <Clock className="w-6 h-6 text-accent" />
              </div>
              <CardTitle className="text-lg">Support Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Our support team is available during business hours.
              </p>
              <p className="text-sm font-medium">Mon – Fri, 9 AM – 6 PM IST</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-6">
            Join hundreds of Indian businesses already managing their books with NexBooks.
          </p>
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
