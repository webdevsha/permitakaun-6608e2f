import { fetchSettingsData } from "@/utils/data/dashboard"
import { SettingsModule } from "@/components/settings-module"

export default async function SettingsPage() {
    const { profile, backups, trialPeriodDays, user } = await fetchSettingsData()

    return (
        <SettingsModule
            initialProfile={profile}
            initialBackups={backups}
            trialPeriodDays={trialPeriodDays}
            currentUser={user}
        />
    )
}
