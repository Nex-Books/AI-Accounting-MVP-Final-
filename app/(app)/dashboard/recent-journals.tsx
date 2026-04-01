'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'
import { ArrowRight } from 'lucide-react'

interface JournalWithLines {
  id: string
  date: string
  description: string
  reference_number: string | null
  created_by_ai: boolean
  lines?: Array<{ debit: number; credit: number }>
}

interface RecentJournalsProps {
  journals: JournalWithLines[]
}

export function RecentJournals({ journals }: RecentJournalsProps) {
  if (journals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Recent Journal Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No journal entries yet. Create your first entry to get started.
            </p>
            <Button asChild>
              <Link href="/journal/new">Create Entry</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Recent Journal Entries</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/journal">
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {journals.map((journal) => (
            <Link
              key={journal.id}
              href={`/journal/${journal.id}`}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">
                    {journal.reference_number || journal.id.slice(0, 8)}
                  </span>
                  {journal.created_by_ai && (
                    <Badge variant="outline" className="text-xs">AI</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {journal.description || 'No description'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  {formatCurrency(journal.lines?.reduce((sum, l) => sum + l.debit, 0) || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(journal.date, 'short')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
