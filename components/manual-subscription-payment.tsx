"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  Loader2, 
  CreditCard, 
  Building2, 
  ArrowRight,
  X,
  Image as ImageIcon
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"
import { useAuth } from "@/components/providers/auth-provider"

interface ManualSubscriptionPaymentProps {
  planName: string
  price: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function ManualSubscriptionPayment({ 
  planName, 
  price, 
  onSuccess, 
  onCancel 
}: ManualSubscriptionPaymentProps) {
  const { user, role } = useAuth()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [transactionId, setTransactionId] = useState("")
  const [bankName, setBankName] = useState("")
  const [notes, setNotes] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  
  const banks = [
    "Maybank",
    "CIMB Bank",
    "Public Bank",
    "RHB Bank",
    "Hong Leong Bank",
    "AmBank",
    "Bank Islam",
    "BSN",
    "Other"
  ]

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        toast.error("Sila muat naik gambar atau PDF sahaja")
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Saiz fail mesti kurang dari 5MB")
        return
      }
      setReceiptFile(file)
    }
  }

  const uploadReceipt = async (): Promise<string | null> => {
    if (!receiptFile) return null
    
    const fileExt = receiptFile.name.split('.').pop()
    const fileName = `subscription-receipts/${user?.id}/${Date.now()}.${fileExt}`
    
    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(fileName, receiptFile, {
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) {
      console.error("Upload error:", error)
      throw new Error("Gagal memuat naik resit")
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName)
    
    return publicUrl
  }

  const handleSubmit = async () => {
    if (!transactionId.trim()) {
      toast.error("Sila masukkan ID Transaksi")
      return
    }
    
    if (!bankName) {
      toast.error("Sila pilih bank")
      return
    }
    
    setLoading(true)
    
    try {
      // Upload receipt if provided
      let receiptUrl = null
      if (receiptFile) {
        receiptUrl = await uploadReceipt()
      }
      
      // 1. Create expense transaction for tenant/organizer (Cash Out)
      const expenseData = {
        description: `Bayaran Langganan - ${planName}`,
        amount: parseFloat(price),
        type: 'expense',
        category: 'Langganan',
        date: new Date().toISOString().split('T')[0],
        status: 'pending', // Pending until admin verifies
        payment_method: 'bank_transfer',
        payment_reference: transactionId,
        receipt_url: receiptUrl,
        notes: `Bank: ${bankName}${notes ? ` | Catatan: ${notes}` : ''}`,
        metadata: {
          plan_type: planName.toLowerCase(),
          bank_name: bankName,
          transaction_id: transactionId,
          is_subscription: true,
          user_id: user?.id,
          user_email: user?.email,
          submitted_at: new Date().toISOString()
        }
      }
      
      let expenseResult
      if (role === 'tenant') {
        // Get tenant ID
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('profile_id', user?.id)
          .single()
        
        if (tenant) {
          expenseResult = await supabase
            .from('tenant_transactions')
            .insert({ ...expenseData, tenant_id: tenant.id })
        }
      } else if (role === 'organizer') {
        // Get organizer ID
        const { data: organizer } = await supabase
          .from('organizers')
          .select('id')
          .eq('profile_id', user?.id)
          .single()
        
        if (organizer) {
          expenseResult = await supabase
            .from('organizer_transactions')
            .insert({ ...expenseData, organizer_id: organizer.id })
        }
      }
      
      if (expenseResult?.error) {
        throw new Error("Gagamenyimpan rekod perbelanjaan")
      }
      
      // 2. Create income transaction for admin (Cash In) - pending verification
      const { error: adminError } = await supabase
        .from('admin_transactions')
        .insert({
          description: `Langganan Pelan ${planName} - ${user?.email}`,
          amount: parseFloat(price),
          type: 'income',
          category: 'Langganan',
          date: new Date().toISOString().split('T')[0],
          status: 'pending', // Pending until admin verifies
          payment_method: 'bank_transfer',
          payment_reference: transactionId,
          receipt_url: receiptUrl,
          notes: `Bank: ${bankName} | ID: ${transactionId}${notes ? ` | ${notes}` : ''}`,
          metadata: {
            plan_type: planName.toLowerCase(),
            bank_name: bankName,
            transaction_id: transactionId,
            payer_email: user?.email,
            payer_name: user?.user_metadata?.full_name || user?.email,
            user_id: user?.id,
            user_role: role,
            is_manual_payment: true,
            requires_verification: true,
            submitted_at: new Date().toISOString()
          }
        })
      
      if (adminError) {
        console.error("Admin transaction error:", adminError)
        // Don't fail, just log it
      }
      
      toast.success("Pembayaran sedang diproses. Admin akan sahkan dalam masa 24 jam.")
      onSuccess?.()
      
    } catch (error: any) {
      console.error("Manual payment error:", error)
      toast.error("Gagal: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-2 border-primary/20 rounded-[2rem]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Pembayaran Manual
            </CardTitle>
            <CardDescription>
              Transfer ke akaun bank admin dan upload resit
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            {planName}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Amount Display */}
        <div className="bg-primary/5 p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground mb-1">Jumlah Bayaran</p>
          <p className="text-3xl font-bold text-primary">RM {price}</p>
        </div>
        
        {/* Bank Transfer Instructions */}
        <div className="bg-slate-50 p-4 rounded-xl space-y-2">
          <h4 className="font-medium text-slate-700 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Maklumat Akaun Bank
          </h4>
          <div className="text-sm space-y-1 text-slate-600">
            <p><strong>Nama:</strong> Hazman</p>
            <p><strong>Bank:</strong> Maybank</p>
            <p><strong>No Akaun:</strong> 1234-5678-9012</p>
            <p><strong>Reference:</strong> LANGGANAN-{user?.email?.split('@')[0]?.toUpperCase()}</p>
          </div>
        </div>
        
        {/* Transaction ID Input */}
        <div className="space-y-2">
          <Label htmlFor="transactionId" className="flex items-center gap-1">
            ID Transaksi / No Reference
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id="transactionId"
            placeholder="Contoh: TRX123456789"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Masukkan nombor rujukan dari resit transfer bank anda
          </p>
        </div>
        
        {/* Bank Selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            Bank Pengirim
            <span className="text-red-500">*</span>
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {banks.map((bank) => (
              <button
                key={bank}
                type="button"
                onClick={() => setBankName(bank)}
                className={`p-2 text-xs rounded-lg border transition-all ${
                  bankName === bank
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {bank}
              </button>
            ))}
          </div>
        </div>
        
        {/* Receipt Upload */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <ImageIcon className="w-4 h-4" />
            Resit Pembayaran (Optional)
          </Label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              receiptFile 
                ? 'border-green-400 bg-green-50' 
                : 'border-border hover:border-primary/50 hover:bg-primary/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {receiptFile ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{receiptFile.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setReceiptFile(null)
                  }}
                  className="ml-2 text-red-500 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Klik untuk muat naik resit</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Gambar atau PDF (max 5MB)
                </p>
              </>
            )}
          </div>
        </div>
        
        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Catatan (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Sebarang maklumat tambahan..."
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            className="rounded-xl min-h-[80px]"
          />
        </div>
        
        {/* Info Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          <p className="flex items-start gap-2">
            <span className="font-bold">ℹ️</span>
            <span>
              Pembayaran manual akan disahkan oleh admin dalam masa <strong>24 jam</strong>. 
              Akses penuh akan diberikan sebaik sahaja pembayaran disahkan.
            </span>
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 rounded-xl"
          onClick={onCancel}
          disabled={loading}
        >
          Batal
        </Button>
        <Button
          className="flex-1 rounded-xl"
          onClick={handleSubmit}
          disabled={loading || !transactionId.trim() || !bankName}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Memproses...
            </>
          ) : (
            <>
              Hantar <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
