"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, AlertCircle, Calendar, ArrowRight, X } from "lucide-react"
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

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [user, role])

  const fetchSubscriptionStatus = async () => {
    if (!user || !role) return
    
    setLoading(true)
    try {
      let latestPayment: any = null

      // Check for subscription payments in admin_transactions (correct place)
      const { data: adminTxns, error } = await supabase
        .from('admin_transactions')
        .select('*')
        .eq('category', 'Langganan')
        .eq('type', 'income')
        .eq('status', 'completed')
        .order('date', { ascending: false })
      
      if (!error && adminTxns) {
        // Filter for this user's payments
        const userPayment = adminTxns.find((tx: any) => {
          const metadata = tx.metadata || {}
          return metadata.payer_email === user.email || metadata.user_id === user.id
        })
        
        if (userPayment) {
          latestPayment = userPayment
        }
      }
      
      // Fallback: Check for active subscription status
      if (!latestPayment) {
        if (role === 'tenant') {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('accounting_status')
            .eq('profile_id', user.id)
            .single()
          
          if (tenantData?.accounting_status === 'active') {
            setHasActiveSubscription(true)
          }
        } else if (role === 'organizer') {
          const { data: organizerData } = await supabase
            .from('organizers')
            .select('accounting_status')
            .eq('profile_id', user.id)
            .single()
          
          if (organizerData?.accounting_status === 'active') {
            setHasActiveSubscription(true)
          }
        }
      }
      
      if (latestPayment) {
        // Calculate next payment date (30 days after last payment)
        const lastDate = new Date(latestPayment.date)
        const nextDate = new Date(lastDate)
        nextDate.setDate(nextDate.getDate() + 30)
        
        setNextPaymentDate(nextDate)
        setHasActiveSubscription(true)
        
        const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        setDaysUntilPayment(daysLeft)
      } else {
        // No payment yet, calculate from profile creation
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
        }
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const getUrgencyColor = () => {
    if (daysUntilPayment <= 3) return 'border-l-red-500 bg-red-50/80'
    if (daysUntilPayment <= 7) return 'border-l-yellow-500 bg-yellow-50/80'
    return 'border-l-blue-500 bg-blue-50/80'
  }

  const getUrgencyText = () => {
    if (daysUntilPayment <= 3) return 'text-red-700'
    if (daysUntilPayment <= 7) return 'text-yellow-700'
    return 'text-blue-700'
  }

  const getIconColor = () => {
    if (daysUntilPayment <= 3) return 'text-red-500'
    if (daysUntilPayment <= 7) return 'text-yellow-500'
    return 'text-blue-500'
  }

  if (loading || !isVisible || daysUntilPayment > 14) {
    return null
  }

  const isUrgent = daysUntilPayment <= 7

  return (
    <Card className={`border-l-4 ${getUrgencyColor()} shadow-sm animate-in slide-in-from-top-2 duration-300`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${getIconColor()}`}>
              {isUrgent ? <AlertCircle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className={`font-semibold ${getUrgencyText()}`}>
                  {hasActiveSubscription 
                    ? 'Bayaran Langganan Seterusnya'
                    : 'Tempoh Percubaan Akan Tamat'
                  }
                </h4>
                {isUrgent && (
                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                    Segera
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {hasActiveSubscription 
                  ? `Langganan Akaun anda perlu diperbaharui dalam ${daysUntilPayment} hari (${formatDate(nextPaymentDate!)})`
                  : `Tempoh percubaan percuma anda akan tamat dalam ${daysUntilPayment} hari`
                }
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Link href="/dashboard/settings?tab=subscription">
                  <Button 
                    size="sm" 
                    className={`rounded-lg ${isUrgent ? 'bg-red-600 hover:bg-red-700' : 'bg-primary'}`}
                  >
                    Bayar Langganan <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
                <Link href="/dashboard/settings">
                  <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground">
                    Lihat Butiran
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
