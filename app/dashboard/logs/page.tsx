"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Trash2, FileText, CheckCircle, PlusCircle, Pencil, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/providers/auth-provider"

export default function LogsPage() {
    const [logs, setLogs] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const { role, user } = useAuth()
    const supabase = createClient()

    const fetchLogs = async () => {
        setIsLoading(true)
        const { data, error } = await supabase
            .from('action_logs')
            .select('*, profiles(email, full_name, role)')
            .order('created_at', { ascending: false })
            .limit(100)

        if (!error && data) {
            setLogs(data)
        }
        setIsLoading(false)
    }

    useEffect(() => {
        fetchLogs()
    }, [])

    const handleDeleteLog = async (id: number) => {
        if (role !== 'admin' && role !== 'superadmin') return
        if (!confirm("Padam log ini?")) return

        const { error } = await supabase.from('action_logs').delete().eq('id', id)
        if (error) {
            toast.error("Gagal padam log")
        } else {
            toast.success("Log dipadam")
            fetchLogs()
        }
    }

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'CREATE': return <PlusCircle className="text-green-500 w-4 h-4" />
            case 'UPDATE': return <Pencil className="text-blue-500 w-4 h-4" />
            case 'DELETE': return <Trash2 className="text-red-500 w-4 h-4" />
            case 'APPROVE': return <CheckCircle className="text-green-600 w-4 h-4" />
            default: return <FileText className="text-gray-500 w-4 h-4" />
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-serif font-bold tracking-tight">Audit Logs</h1>
                    <p className="text-muted-foreground">Rekod aktiviti pengguna dan sistem.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLogs}>
                    Refresh
                </Button>
            </div>

            <Card className="border-border/50 shadow-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-secondary/20">
                            <TableRow>
                                <TableHead>Masa</TableHead>
                                <TableHead>Pengguna</TableHead>
                                <TableHead>Tindakan</TableHead>
                                <TableHead>Resource</TableHead>
                                <TableHead>Butiran</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8"><Loader2 className="animate-spin inline mr-2" /> Memuatkan log...</TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tiada rekod aktiviti.</TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-slate-50/50">
                                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString('ms-MY')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-xs">{log.profiles?.full_name || "Unknown"}</span>
                                                <span className="text-[10px] text-muted-foreground">{log.profiles?.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getActionIcon(log.action)}
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                                                    {log.action}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="capitalize text-sm font-medium text-foreground/80">
                                            {log.resource} <span className="text-xs text-muted-foreground ml-1">#{log.resource_id}</span>
                                        </TableCell>
                                        <TableCell className="max-w-[300px] truncate text-xs font-mono text-slate-500">
                                            {JSON.stringify(log.details)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(role === 'admin' || role === 'superadmin') && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" onClick={() => handleDeleteLog(log.id)}>
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
