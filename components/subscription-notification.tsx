"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, AlertCircle, Calendar, ArrowRight, X, CheckCircle } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/providers/auth-provider"
import Link from "next/link"

export function SubscriptionNotification() {
  const { user, role } = useAuth()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [daysUntilPayment, setDaysUntilPayment] = useState<number>(0)
  const [nextPaymentDate, setNextPaymentDate] = useState<Date | null>(null)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [accountStatus, setAccountStatus] = useState<'trial' | 'active' | 'expired'>('trial')

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [user, role])

  const fetchSubscriptionStatus = async () => {
    if (!user || !role) {
      setLoading(false)
      return
    }

    // FAST-PATH: Set loading false after max 3 seconds no matter what
    const timeoutId = setTimeout(() => {
      setLoading(false)
    }, 3000)

    try {
      // PRIORITY 1: Check user's own expense transactions (fastest - direct query)
      let hasSubscription = false
      let latestPaymentDate: string | null = null

      if (role === 'tenant') {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id, accounting_status')
          .eq('profile_id', user.id)
          .single()

        if (tenant?.accounting_status === 'active') {
          hasSubscription = true
          setAccountStatus('active')
        }

        if (tenant) {
          const { data: payments } = await supabase
            .from('tenant_transactions')
            .select('date, status')
            .eq('tenant_id', tenant.id)
            .eq('category', 'Langganan')
            .eq('type', 'expense')
            .eq('status', 'approved')
            .order('date', { ascending: false })
            .limit(1)

          if (payments && payments.length > 0) {
            hasSubscription = true
            latestPaymentDate = payments[0].date
            setAccountStatus('active')
          }
        }
      } else if (role === 'organizer') {
        const { data: organizer } = await supabase
          .from('organizers')
          .select('id, accounting_status')
          .eq('profile_id', user.id)
          .single()

        if (organizer?.accounting_status === 'active') {
          hasSubscription = true
          setAccountStatus('active')
        }

        if (organizer) {
          const { data: payments } = await supabase
            .from('organizer_transactions')
            .select('date, status')
            .eq('organizer_id', organizer.id)
            .eq('category', 'Langganan')
            .eq('type', 'expense')
            .eq('status', 'approved')
            .order('date', { ascending: false })
            .limit(1)

          if (payments && payments.length > 0) {
            hasSubscription = true
            latestPaymentDate = payments[0].date
            setAccountStatus('active')
          }
        }
      }

      if (hasSubscription && latestPaymentDate) {
        // Calculate next payment date (30 days after last payment)
        const lastDate = new Date(latestPaymentDate)
        const nextDate = new Date(lastDate)
        nextDate.setDate(nextDate.getDate() + 30)

        setNextPaymentDate(nextDate)
        setHasActiveSubscription(true)

        const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        setDaysUntilPayment(daysLeft)
      } else if (!hasSubscription) {
        // No subscription - check trial period
        const { data: profile } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('id', user.id)
          .single()

        if (profile) {
          const createdDate = new Date(profile.created_at)
          const nextDate = new Date(createdDate)
          nextDate.setDate(nextDate.getDate() + 14) // 14 days trial

          setNextPaymentDate(nextDate)

          const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          setDaysUntilPayment(daysLeft)

          if (daysLeft <= 0) {
            setAccountStatus('expired')
          } else {
            setAccountStatus('trial')
          }
        }
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error)
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'Unknown Date'
    return date.toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const getUrgencyColor = () => {
    if (accountStatus === 'active') return 'border-l-green-500 bg-green-50/80'
    if (daysUntilPayment <= 3) return 'border-l-red-500 bg-red-50/80'
    if (daysUntilPayment <= 7) return 'border-l-yellow-500 bg-yellow-50/80'
    return 'border-l-blue-500 bg-blue-50/80'
  }

  const getUrgencyText = () => {
    if (accountStatus === 'active') return 'text-green-700'
    if (daysUntilPayment <= 3) return 'text-red-700'
    if (daysUntilPayment <= 7) return 'text-yellow-700'
    return 'text-blue-700'
  }

  const getIconColor = () => {
    if (accountStatus === 'active') return 'text-green-500'
    if (daysUntilPayment <= 3) return 'text-red-500'
    if (daysUntilPayment <= 7) return 'text-yellow-500'
    return 'text-blue-500'
  }

  // DON'T show notification if:
  // 1. Still loading
  // 2. User has active subscription (don't show trial expired warning)
  // 3. Hidden by user
  if (loading) return null

  // If subscription is active and more than 7 days until next payment, don't show
  if (accountStatus === 'active' && daysUntilPayment > 7) return null

  if (!isVisible) return null

  const isUrgent = daysUntilPayment <= 7 && accountStatus !== 'active'

  return (
    <Card className={`border-l-4 ${getUrgencyColor()} shadow-sm animate-in slide-in-from-top-2 duration-300`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${getIconColor()}`}>
              {accountStatus === 'active' ? (
                <CheckCircle className="w-5 h-5" />
              ) : isUrgent ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className={`font-semibold ${getUrgencyText()}`}>
                  {accountStatus === 'active'
                    ? 'Langganan Aktif'
                    : accountStatus === 'expired'
                      ? 'Tempoh Percubaan Tamat'
                      : 'Bayaran Langganan Seterusnya'
                  }
                </h4>
                {accountStatus === 'active' ? (
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                    Aktif
                  </Badge>
                ) : isUrgent && (
                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                    Segera
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {accountStatus === 'active'
                  ? `Langganan anda aktif. Pembayaran seterusnya dalam ${daysUntilPayment} hari (${formatDate(nextPaymentDate!)})`
                  : accountStatus === 'expired'
                    ? 'Tempoh percubaan anda telah tamat. Sila langgan untuk terus menggunakan ciri Akaun.'
                    : `Langganan Akaun anda perlu diperbaharui dalam ${daysUntilPayment} hari`
                }
              </p>
              <div className="flex items-center gap-2 pt-1">
                {accountStatus !== 'active' && (
                  <Link href="/dashboard/settings?tab=subscription">
                    <Button
                      size="sm"
                      className={`rounded-lg ${isUrgent ? 'bg-red-600 hover:bg-red-700' : 'bg-primary'}`}
                    >
                      {accountStatus === 'expired' ? 'Langgan Sekarang' : 'Bayar Langganan'}
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
                <Link href="/dashboard/settings">
                  <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground">
                    {accountStatus === 'active' ? 'Lihat Butiran' : 'Lihat Status'}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setIsVisible(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
