"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, CreditCard, ArrowRight, Bell, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/providers/auth-provider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"

interface SubscriptionRecord {
  id: number
  amount: number
  date: string
  status: string
  description: string
  receipt_url?: string
  payment_reference?: string
  created_at: string
}

export function SubscriptionTab() {
  const { user, role } = useAuth()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [nextPaymentDate, setNextPaymentDate] = useState<Date | null>(null)
  const [daysUntilPayment, setDaysUntilPayment] = useState<number>(0)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [userEmail, setUserEmail] = useState<string>("")

  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email)
      fetchSubscriptionData()
    } else {
      // If no user initially, make sure we don't stick on loading forever if it never comes
      const timer = setTimeout(() => setLoading(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [user, role])

  const fetchSubscriptionData = async () => {
    // Safety timeout to prevent infinite loading
    const safetyTimer = setTimeout(() => {
      if (loading) setLoading(false)
    }, 5000)

    if (!user || !role) {
      clearTimeout(safetyTimer)
      return
    }

    setLoading(true)
    try {
      // Fetch user's own subscription PAYMENTS (Cash Out - expense) from their transactions
      // This shows what THEY paid for their subscription
      let userPayments: any[] = []

      if (role === 'tenant') {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('profile_id', user.id)
          .single()

        if (tenant) {
          const { data: tenantTxns } = await supabase
            .from('tenant_transactions')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('category', 'Langganan')
            .eq('type', 'expense')
            .order('date', { ascending: false })

          if (tenantTxns) {
            userPayments = tenantTxns
          }
        }
      } else if (role === 'organizer') {
        const { data: organizer } = await supabase
          .from('organizers')
          .select('id')
          .eq('profile_id', user.id)
          .single()

        if (organizer) {
          const { data: orgTxns } = await supabase
            .from('organizer_transactions')
            .select('*')
            .eq('organizer_id', organizer.id)
            .eq('category', 'Langganan')
            .eq('type', 'expense')
            .order('date', { ascending: false })

          if (orgTxns) {
            userPayments = orgTxns
          }
        }
      }

      // Map user payments to subscription records
      if (userPayments.length > 0) {
        setSubscriptions(userPayments.map((t: any) => ({
          id: t.id,
          amount: t.amount,
          date: t.date,
          status: t.status,
          description: t.description,
          receipt_url: t.receipt_url,
          payment_reference: t.payment_reference,
          created_at: t.created_at
        })))

        // Calculate next payment based on the most recent payment
        const latestPayment = userPayments[0]
        calculateNextPayment(latestPayment.date)

        // Check if subscription is active (has at least one approved payment)
        const hasCompletedPayment = userPayments.some((p: any) =>
          p.status === 'approved'
        )
        setHasActiveSubscription(hasCompletedPayment || latestPayment.status === 'pending')
      } else {
        // Check for active subscription in subscriptions table (for tenants)
        if (role === 'tenant') {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('id, accounting_status')
            .eq('profile_id', user.id)
            .single()

          if (tenantData?.accounting_status === 'active') {
            setHasActiveSubscription(true)
          }
        } else if (role === 'organizer') {
          const { data: organizerData } = await supabase
            .from('organizers')
            .select('id, accounting_status')
            .eq('profile_id', user.id)
            .single()

          if (organizerData?.accounting_status === 'active') {
            setHasActiveSubscription(true)
          }
        }

        // If no subscription records, calculate from profile creation date
        const { data: profile } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('id', user.id)
          .single()

        if (profile) {
          const createdDate = new Date(profile.created_at)
          const nextDate = new Date(createdDate)
          nextDate.setDate(nextDate.getDate() + 14) // Trial period

          setNextPaymentDate(nextDate)
          const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          setDaysUntilPayment(daysLeft)
        }
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error)
    } finally {
      clearTimeout(safetyTimer)
      setLoading(false)
    }
  }

  const calculateNextPayment = (lastPaymentDate: string) => {
    const lastDate = new Date(lastPaymentDate)
    const nextDate = new Date(lastDate)
    nextDate.setDate(nextDate.getDate() + 30) // 30 days subscription

    setNextPaymentDate(nextDate)
    const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    setDaysUntilPayment(daysLeft)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin mr-2" />
        <span className="text-muted-foreground">Memuatkan rekod langganan...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Next Payment Card */}
      <Card className={`border-l-4 ${daysUntilPayment <= 3 ? 'border-l-red-500 bg-red-50/50' : daysUntilPayment <= 7 ? 'border-l-yellow-500 bg-yellow-50/50' : 'border-l-green-500 bg-green-50/50'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-serif flex items-center gap-2">
                <Bell className={`w-5 h-5 ${daysUntilPayment <= 3 ? 'text-red-500' : daysUntilPayment <= 7 ? 'text-yellow-500' : 'text-green-500'}`} />
                Bayaran Langganan Seterusnya
              </CardTitle>
              <CardDescription className="mt-2">
                {hasActiveSubscription
                  ? `Langganan Akaun anda perlu diperbaharui dalam ${daysUntilPayment} hari`
                  : 'Anda sedang dalam tempoh percubaan 14 hari'
                }
              </CardDescription>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${daysUntilPayment <= 3 ? 'text-red-600' : daysUntilPayment <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                {daysUntilPayment}
              </div>
              <div className="text-sm text-muted-foreground">Hari Lagi</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Tarikh Bayaran Seterusnya:</p>
              <p className="text-lg font-medium">
                {nextPaymentDate ? formatDate(nextPaymentDate.toISOString()) : '-'}
              </p>
            </div>
            <Link href="/dashboard/subscription">
              <Button className={`${daysUntilPayment <= 3 ? 'bg-red-600 hover:bg-red-700' : 'bg-primary'} rounded-xl`}>
                <CreditCard className="w-4 h-4 mr-2" />
                Bayar Langganan
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-serif flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Rekod Pembayaran Langganan
          </CardTitle>
          <CardDescription>
            Sejarah pembayaran langganan Akaun anda kepada admin@kumim.my
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Tiada rekod pembayaran langganan lagi.</p>
              <p className="text-sm mt-2">Anda sedang menikmati tempoh percubaan percuma.</p>
              <Link href="/dashboard/subscription" className="inline-block mt-4">
                <Button variant="outline" className="rounded-xl">
                  Lihat Pelan Langganan <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarikh</TableHead>
                  <TableHead>Pelan</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Resit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {formatDate(sub.date)}
                    </TableCell>
                    <TableCell>
                      {sub.description.replace('Langganan Pelan ', '')}
                    </TableCell>
                    <TableCell className="font-bold">
                      RM {sub.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Selesai
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {sub.receipt_url ? (
                        <a
                          href={sub.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm"
                        >
                          Lihat Resit
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Info */}
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-slate-700">
            Maklumat Pembayaran
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Bayaran Kepada:</p>
              <p className="font-medium">Hazman (admin@kumim.my)</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kekerapan:</p>
              <p className="font-medium">Setiap 30 hari</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kaedah Bayaran:</p>
              <p className="font-medium">Billplz (Online Banking)</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status Semasa:</p>
              <p className="font-medium">
                {hasActiveSubscription ? (
                  <span className="text-green-600">Aktif</span>
                ) : (
                  <span className="text-blue-600">Percubaan Percuma</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
