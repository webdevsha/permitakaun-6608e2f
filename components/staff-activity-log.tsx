"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, FileText, PlusCircle, Pencil, Trash2, CheckCircle } from "lucide-react"
import { toast } from "sonner"

interface StaffActivityLogProps {
    staffIds?: string[]
}

export function StaffActivityLog({ staffIds }: StaffActivityLogProps) {
    const [logs, setLogs] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    const fetchStaffActivity = async () => {
        setIsLoading(true)
        try {
            // First get staff user IDs from profiles
            let staffUserIds: string[] = []
            
            if (staffIds && staffIds.length > 0) {
                staffUserIds = staffIds
            } else {
                // Get all staff user IDs
                const { data: staffProfiles, error: staffError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('role', 'staff')
                
                if (!staffError && staffProfiles) {
                    staffUserIds = staffProfiles.map(p => p.id)
                }
            }
            
            // If no staff found, return empty
            if (staffUserIds.length === 0) {
                setLogs([])
                setIsLoading(false)
                return
            }
            
            // Fetch logs for staff users
            const { data, error } = await supabase
                .from('action_logs')
                .select('*')
                .in('user_id', staffUserIds)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            
            // Fetch profiles separately for the display names
            const userIds = data?.map(log => log.user_id) || []
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, email, full_name, role')
                .in('id', userIds)
            
            // Merge logs with profiles
            const enrichedLogs = data?.map(log => ({
                ...log,
                profiles: profilesData?.find(p => p.id === log.user_id) || null
            })) || []
            
            setLogs(enrichedLogs)
        } catch (error) {
            console.error("Error fetching staff activity:", error)
            toast.error("Gagal memuatkan log aktiviti")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchStaffActivity()
    }, [staffIds])

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'CREATE': return <PlusCircle className="text-green-500 w-4 h-4" />
            case 'UPDATE': return <Pencil className="text-blue-500 w-4 h-4" />
            case 'DELETE': return <Trash2 className="text-red-500 w-4 h-4" />
            case 'APPROVE': return <CheckCircle className="text-green-600 w-4 h-4" />
            default: return <FileText className="text-gray-500 w-4 h-4" />
        }
    }

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'bg-green-100 text-green-700 border-green-200'
            case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'DELETE': return 'bg-red-100 text-red-700 border-red-200'
            case 'APPROVE': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            default: return 'bg-gray-100 text-gray-700 border-gray-200'
        }
    }

    return (
        <Card className="bg-white border-border/50 shadow-sm rounded-[1.5rem] overflow-hidden">
            <CardHeader className="bg-secondary/10 border-b border-border/30">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="font-serif text-xl flex items-center gap-2">
                            <FileText className="text-primary w-5 h-5" /> Log Aktiviti Staf
                        </CardTitle>
                        <CardDescription>Rekod tindakan terkini oleh staf</CardDescription>
                    </div>
                    <Button onClick={fetchStaffActivity} disabled={isLoading} variant="outline" size="sm">
                        <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} /> Refresh
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="p-12 flex justify-center">
                        <Loader2 className="animate-spin text-muted-foreground" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>Tiada rekod aktiviti staf.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-secondary/20">
                            <TableRow>
                                <TableHead className="pl-6">Masa</TableHead>
                                <TableHead>Staf</TableHead>
                                <TableHead>Tindakan</TableHead>
                                <TableHead>Rekod</TableHead>
                                <TableHead className="pr-6">Butiran</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id} className="hover:bg-slate-50/50">
                                    <TableCell className="pl-6 font-mono text-xs text-muted-foreground whitespace-nowrap">
                                        {new Date(log.created_at).toLocaleString('ms-MY', {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
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
                                            <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-wider", getActionColor(log.action))}>
                                                {log.action}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="capitalize text-sm font-medium text-foreground/80">
                                        {log.resource} <span className="text-xs text-muted-foreground">#{log.resource_id}</span>
                                    </TableCell>
                                    <TableCell className="pr-6 max-w-[200px] truncate text-xs font-mono text-slate-500">
                                        {log.details ? JSON.stringify(log.details).slice(0, 50) + '...' : '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}

// Helper for cn function
function cn(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(' ')
}
