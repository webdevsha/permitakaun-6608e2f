"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  CreditCard, 
  Calendar, 
  User, 
  Banknote,
  ExternalLink,
  RefreshCw,
  Search,
  Filter
} from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SubscriptionPayment {
  id: number
  amount: number
  description: string
  date: string
  status: string
  payment_method: string
  payment_reference: string
  receipt_url: string | null
  metadata: any
  notes: string | null
  created_at: string
  payer_email?: string
  payer_name?: string
  user_role?: string
}

export function AdminSubscriptionsTab() {
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<SubscriptionPayment[]>([])
  const [filteredPayments, setFilteredPayments] = useState<SubscriptionPayment[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<SubscriptionPayment | null>(null)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalAmount: 0
  })

  useEffect(() => {
    fetchSubscriptionPayments()
  }, [])

  useEffect(() => {
    filterPayments()
  }, [payments, statusFilter, searchQuery])

  const fetchSubscriptionPayments = async () => {
    setLoading(true)
    try {
      // Fetch from admin_transactions where category is Langganan
      const { data, error } = await supabase
        .from('admin_transactions')
        .select('*')
        .eq('category', 'Langganan')
        .eq('type', 'income')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching subscription payments:', error)
        toast.error('Gagal memuatkan data langganan')
        return
      }

      const formattedPayments: SubscriptionPayment[] = (data || []).map((tx: any) => {
        const metadata = tx.metadata || {}
        return {
          id: tx.id,
          amount: tx.amount,
          description: tx.description,
          date: tx.date,
          status: tx.status,
          payment_method: tx.payment_method || 'bank_transfer',
          payment_reference: tx.payment_reference || '',
          receipt_url: tx.receipt_url,
          metadata: metadata,
          notes: tx.notes,
          created_at: tx.created_at,
          payer_email: metadata.payer_email || metadata.user_email,
          payer_name: metadata.payer_name,
          user_role: metadata.user_role
        }
      })

      setPayments(formattedPayments)
      
      // Calculate stats
      const pending = formattedPayments.filter(p => p.status === 'pending').length
      const approved = formattedPayments.filter(p => p.status === 'approved').length
      const rejected = formattedPayments.filter(p => p.status === 'rejected').length
      const totalAmount = formattedPayments
        .filter(p => p.status === 'approved')
        .reduce((sum, p) => sum + p.amount, 0)
      
      setStats({
        total: formattedPayments.length,
        pending,
        approved,
        rejected,
        totalAmount
      })
    } catch (error) {
      console.error('Error:', error)
      toast.error('Ralat semasa memuatkan data')
    } finally {
      setLoading(false)
    }
  }

  const filterPayments = () => {
    let filtered = [...payments]
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter)
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        (p.payer_email?.toLowerCase().includes(query)) ||
        (p.payer_name?.toLowerCase().includes(query)) ||
        (p.payment_reference?.toLowerCase().includes(query)) ||
        (p.description?.toLowerCase().includes(query))
      )
    }
    
    setFilteredPayments(filtered)
  }

  const handleApprove = async () => {
    if (!selectedPayment) return
    
    setProcessing(true)
    try {
      // 1. Update admin_transactions status
      const { error: txError } = await supabase
        .from('admin_transactions')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPayment.id)

      if (txError) throw txError

      // 2. Activate the user's subscription
      const metadata = selectedPayment.metadata || {}
      const userId = metadata.user_id
      const userRole = metadata.user_role || metadata.role
      
      if (userId) {
        const now = new Date()
        const endDate = new Date()
        endDate.setDate(now.getDate() + 30)
        
        if (userRole === 'tenant') {
          // Get tenant and update
          const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('profile_id', userId)
            .single()
          
          if (tenant) {
            await supabase.from('subscriptions').insert({
              tenant_id: tenant.id,
              plan_type: metadata.plan_type || 'basic',
              status: 'active',
              start_date: now.toISOString(),
              end_date: endDate.toISOString(),
              amount: selectedPayment.amount,
              payment_ref: selectedPayment.payment_reference
            })
            
            await supabase
              .from('tenants')
              .update({ accounting_status: 'active' })
              .eq('id', tenant.id)
          }
        } else {
          // Organizer
          const { data: organizer } = await supabase
            .from('organizers')
            .select('id')
            .eq('profile_id', userId)
            .single()
          
          if (organizer) {
            await supabase
              .from('organizers')
              .update({ 
                accounting_status: 'active',
                updated_at: now.toISOString()
              })
              .eq('id', organizer.id)
          }
        }
      }
      
      toast.success('Langganan telah diluluskan dan diaktifkan')
      setApproveDialogOpen(false)
      fetchSubscriptionPayments()
    } catch (error: any) {
      console.error('Error approving:', error)
      toast.error('Gagal meluluskan: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedPayment) return
    
    setProcessing(true)
    try {
      const { error } = await supabase
        .from('admin_transactions')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPayment.id)

      if (error) throw error
      
      toast.success('Pembayaran telah ditolak')
      setRejectDialogOpen(false)
      fetchSubscriptionPayments()
    } catch (error: any) {
      console.error('Error rejecting:', error)
      toast.error('Gagal menolak: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ms-MY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatAmount = (amount: number) => {
    return `RM ${amount.toFixed(2)}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Selesai</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200"><RefreshCw className="w-3 h-3 mr-1" /> Menunggu</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Ditolak</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin mr-2" />
        <span className="text-muted-foreground">Memuatkan data langganan...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Jumlah Bayaran</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-yellow-50 border-yellow-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-yellow-700">Menunggu</CardDescription>
            <CardTitle className="text-2xl text-yellow-800">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-green-700">Diluluskan</CardDescription>
            <CardTitle className="text-2xl text-green-800">{stats.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary">Jumlah Kutipan</CardDescription>
            <CardTitle className="text-2xl text-primary">{formatAmount(stats.totalAmount)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari emel, nama, atau ID transaksi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchSubscriptionPayments}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Senarai Pembayaran Langganan
          </CardTitle>
          <CardDescription>
            Sahkan pembayaran langganan untuk mengaktifkan akses Akaun pengguna
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Tiada rekod pembayaran langganan.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pembayar</TableHead>
                  <TableHead>Pelan</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>ID Transaksi</TableHead>
                  <TableHead>Tarikh</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payment.payer_name || '-'}</p>
                        <p className="text-sm text-muted-foreground">{payment.payer_email}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {payment.user_role === 'tenant' ? 'Peniaga' : 'Penganjur'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {payment.description.replace('Langganan Pelan ', '').replace('Bayaran Langganan - ', '')}
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatAmount(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                        {payment.payment_reference || '-'}
                      </code>
                    </TableCell>
                    <TableCell>{formatDate(payment.date)}</TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {payment.receipt_url && (
                          <a 
                            href={payment.receipt_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="icon" title="Lihat Resit">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </a>
                        )}
                        {payment.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => {
                                setSelectedPayment(payment)
                                setApproveDialogOpen(true)
                              }}
                              title="Luluskan"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setSelectedPayment(payment)
                                setRejectDialogOpen(true)
                              }}
                              title="Tolak"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Luluskan Pembayaran Langganan</DialogTitle>
            <DialogDescription>
              Adakah anda pasti untuk meluluskan pembayaran ini? Akses Akaun pengguna akan diaktifkan.
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-3 py-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pembayar:</span>
                <span className="font-medium">{selectedPayment.payer_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jumlah:</span>
                <span className="font-bold">{formatAmount(selectedPayment.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID Transaksi:</span>
                <code className="text-sm">{selectedPayment.payment_reference}</code>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} disabled={processing}>
              Batal
            </Button>
            <Button onClick={handleApprove} disabled={processing} className="bg-green-600 hover:bg-green-700">
              {processing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Luluskan & Aktifkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Pembayaran</DialogTitle>
            <DialogDescription>
              Adakah anda pasti untuk menolak pembayaran ini?
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-3 py-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pembayar:</span>
                <span className="font-medium">{selectedPayment.payer_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jumlah:</span>
                <span className="font-bold">{formatAmount(selectedPayment.amount)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={processing}>
              Batal
            </Button>
            <Button onClick={handleReject} disabled={processing} variant="destructive">
              {processing ? <Loader2 className="animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
