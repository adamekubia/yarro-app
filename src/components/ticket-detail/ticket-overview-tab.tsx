'use client'

import { StatusBadge } from '@/components/status-badge'
import { format } from 'date-fns'
import { Building2, Users, Wrench, Phone, Mail, Calendar, MapPin, Clock, Shield, Image } from 'lucide-react'
import Link from 'next/link'
import type { TicketContext, TicketBasic } from '@/hooks/use-ticket-detail'
import { formatCurrency } from '@/hooks/use-ticket-detail'

interface TicketOverviewTabProps {
  context: TicketContext
  basic: TicketBasic
}

function formatDate(date: string | null) {
  if (!date) return '-'
  return format(new Date(date), 'dd MMM yyyy')
}

function formatDateTime(date: string | null) {
  if (!date) return '-'
  return format(new Date(date), 'dd MMM yyyy, HH:mm')
}

export function TicketOverviewTab({ context, basic }: TicketOverviewTabProps) {
  const images = basic.images || []

  return (
    <div className="space-y-6">
      {/* Issue Description */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Issue</h4>
        <p className="text-sm leading-relaxed">
          {context.issue_description || 'No description provided'}
        </p>
      </div>

      {/* Details Grid */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Details</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <div className="p-2.5 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Category</p>
            <p className="text-sm font-medium">{context.category || '-'}</p>
          </div>
          <div className="p-2.5 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Date Logged</p>
            <p className="text-sm font-medium">{formatDate(context.date_logged)}</p>
          </div>
          <div className="p-2.5 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Reporter</p>
            <p className="text-sm font-medium capitalize">{context.reporter_role || '-'}</p>
          </div>
          {context.availability && (
            <div className="p-2.5 bg-muted/50 rounded-lg flex items-start gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Availability</p>
                <p className="text-sm font-medium">{context.availability}</p>
              </div>
            </div>
          )}
          {context.access && (
            <div className="p-2.5 bg-muted/50 rounded-lg flex items-start gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Access</p>
                <p className="text-sm font-medium">{context.access}</p>
              </div>
            </div>
          )}
          {basic.scheduled_date && (
            <div className="p-2.5 bg-teal-50 dark:bg-teal-950/30 rounded-lg flex items-start gap-2">
              <Calendar className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-teal-600 dark:text-teal-400">Scheduled</p>
                <p className="text-sm font-medium text-teal-700 dark:text-teal-300">{formatDate(basic.scheduled_date)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Financial (only when relevant) */}
      {(basic.contractor_quote || basic.final_amount) && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Financials</h4>
          <div className="grid grid-cols-2 gap-2">
            {basic.contractor_quote && (
              <div className="p-2.5 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Quote</p>
                <p className="text-sm font-medium font-mono">{formatCurrency(basic.contractor_quote)}</p>
              </div>
            )}
            {basic.final_amount && (
              <div className="p-2.5 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <p className="text-xs text-green-600 dark:text-green-400">Final Amount</p>
                <p className="text-sm font-bold font-mono text-green-700 dark:text-green-300">{formatCurrency(basic.final_amount)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* People */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">People</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Tenant */}
          {context.tenant_name && (
            <Link
              href={basic.tenant_id ? `/tenants?id=${basic.tenant_id}` : '#'}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{context.tenant_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {context.tenant_phone && <span>{context.tenant_phone}</span>}
                  {context.tenant_role_tag && (
                    <span className="px-1.5 py-0 rounded bg-muted text-[10px]">{context.tenant_role_tag}</span>
                  )}
                </div>
              </div>
            </Link>
          )}

          {/* Property */}
          <Link
            href={`/properties?id=${context.property_id}`}
            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{context.property_address}</p>
              <p className="text-xs text-muted-foreground">View property</p>
            </div>
          </Link>

          {/* Contractor */}
          {basic.contractor_name && basic.contractor_id && (
            <Link
              href={`/contractors?id=${basic.contractor_id}`}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                <Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{basic.contractor_name}</p>
                <p className="text-xs text-muted-foreground">View contractor</p>
              </div>
            </Link>
          )}

          {/* Landlord */}
          {context.landlord_name && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{context.landlord_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {context.landlord_phone && <span>{context.landlord_phone}</span>}
                  {context.landlord_email && <span className="truncate">{context.landlord_email}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Photos */}
      {images.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Photos ({images.length})
          </h4>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {images.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <img
                  src={url}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-20 object-cover rounded-lg border group-hover:opacity-80 transition-opacity"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
