import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="grid w-full max-w-sm items-center gap-1.5">
                {label && <Label htmlFor={props.id}>{label}</Label>}
                <Input
                    type="file"
                    className={cn("cursor-pointer", className)}
                    ref={ref}
                    {...props}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
        )
    }
)
FileInput.displayName = "FileInput"

export { FileInput }
