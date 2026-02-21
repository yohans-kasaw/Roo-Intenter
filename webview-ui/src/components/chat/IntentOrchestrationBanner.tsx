import { memo } from "react"
import { CheckCircle2, CircleDot, Clock, Target } from "lucide-react"

import { cn } from "@/lib/utils"
import { useExtensionState } from "@/context/ExtensionStateContext"

const statusClasses: Record<string, { dot: string; text: string; badge: string }> = {
	IN_PROGRESS: {
		dot: "bg-emerald-500",
		text: "text-emerald-500",
		badge: "border-emerald-500/40 text-emerald-500",
	},
	COMPLETED: {
		dot: "bg-vscode-descriptionForeground",
		text: "text-vscode-descriptionForeground",
		badge: "border-vscode-descriptionForeground/30 text-vscode-descriptionForeground",
	},
	PENDING: {
		dot: "bg-yellow-500",
		text: "text-yellow-500",
		badge: "border-yellow-500/40 text-yellow-500",
	},
}

const IntentOrchestrationBanner = () => {
	const { intentOrchestration } = useExtensionState()

	if (!intentOrchestration) {
		return null
	}

	const status = intentOrchestration.activeIntentStatus || "PENDING"
	const styles = statusClasses[status] ?? statusClasses.PENDING
	const hasScope = (intentOrchestration.ownedScope || []).length > 0
	const hasConstraints = (intentOrchestration.constraints || []).length > 0
	const selectedAt = intentOrchestration.selectedAt ? new Date(intentOrchestration.selectedAt) : null
	const selectedAtLabel = selectedAt && !Number.isNaN(selectedAt.getTime()) ? selectedAt.toLocaleString() : null

	return (
		<div className="px-3 pt-1.5">
			<div
				className={cn(
					"rounded-xl border border-vscode-panel-border/60",
					"bg-vscode-input-background/60 text-vscode-foreground",
					"shadow-sm shadow-vscode-sideBar-background/40",
					"px-3 py-2 flex flex-col gap-1.5",
				)}>
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<span className="flex items-center justify-center w-5 h-5 rounded-md bg-vscode-sideBar-background">
							<Target className="w-3.5 h-3.5" />
						</span>
						<div className="min-w-0">
							<div className="text-xs uppercase tracking-[0.18em] text-vscode-descriptionForeground">
								Intent Orchestration
							</div>
							<div className="text-sm font-medium truncate">
								{intentOrchestration.activeIntentName || "Active Intent"}
							</div>
						</div>
					</div>
					<div
						className={cn(
							"flex items-center gap-2 text-xs font-medium",
							"rounded-full border px-2 py-0.5",
							styles.badge,
						)}>
						<span className={cn("inline-flex w-2 h-2 rounded-full", styles.dot)} />
						{status}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 text-xs text-vscode-descriptionForeground">
					<div className="flex items-center gap-1.5">
						<CircleDot className={cn("w-3.5 h-3.5", styles.text)} />
						<span className="font-mono">{intentOrchestration.activeIntentId}</span>
					</div>
					{selectedAtLabel && (
						<div className="flex items-center gap-1.5">
							<Clock className="w-3.5 h-3.5" />
							<span>Selected {selectedAtLabel}</span>
						</div>
					)}
					<div className="flex items-center gap-1.5">
						<CheckCircle2
							className={cn(
								"w-3.5 h-3.5",
								intentOrchestration.contextInjected ? "text-emerald-500" : "text-yellow-500",
							)}
						/>
						<span>Context {intentOrchestration.contextInjected ? "Injected" : "Pending"}</span>
					</div>
				</div>

				<div className="grid gap-2 text-xs text-vscode-descriptionForeground">
					<div className="flex flex-wrap items-center gap-2">
						<span className="uppercase tracking-[0.18em] text-[10px] text-vscode-descriptionForeground">
							Scope
						</span>
						{hasScope ? (
							intentOrchestration.ownedScope?.slice(0, 3).map((scope) => (
								<span
									key={scope}
									className="rounded-md border border-vscode-panel-border/60 bg-vscode-editor-background/60 px-2 py-0.5 font-mono text-[11px]">
									{scope}
								</span>
							))
						) : (
							<span className="italic">No scope defined</span>
						)}
						{intentOrchestration.ownedScope && intentOrchestration.ownedScope.length > 3 && (
							<span className="text-[11px]">+{intentOrchestration.ownedScope.length - 3} more</span>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<span className="uppercase tracking-[0.18em] text-[10px] text-vscode-descriptionForeground">
							Constraints
						</span>
						{hasConstraints ? (
							intentOrchestration.constraints?.slice(0, 2).map((constraint) => (
								<span
									key={constraint}
									className="rounded-md border border-vscode-panel-border/60 bg-vscode-editor-background/60 px-2 py-0.5 text-[11px]">
									{constraint}
								</span>
							))
						) : (
							<span className="italic">None</span>
						)}
						{intentOrchestration.constraints && intentOrchestration.constraints.length > 2 && (
							<span className="text-[11px]">+{intentOrchestration.constraints.length - 2} more</span>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

export default memo(IntentOrchestrationBanner)
