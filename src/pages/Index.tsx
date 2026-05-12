import { useHarnessAgent } from "@/hooks/useHarnessAgent";
import { AgentHeader } from "@/components/agent/AgentHeader";
import { GoalInput } from "@/components/agent/GoalInput";
import { TaskList } from "@/components/agent/TaskList";
import { TerminalOutput } from "@/components/agent/TerminalOutput";
import { AlertCircle, CircleCheck, Trophy } from "lucide-react";

const Index = () => {
  const {
    status,
    tasks,
    taskStatuses,
    taskOutputs,
    activeTaskId,
    error,
    currentGoal,
    runAgent,
    reset,
  } = useHarnessAgent();

  return (
    <div className="w-full h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <AgentHeader status={status} currentGoal={currentGoal} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

          {/* Grid lines decoration */}
          <div
            className="fixed inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(142 100% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(142 100% 50%) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          {/* Goal Input */}
          <GoalInput status={status} onRun={runAgent} onReset={reset} />

          {/* Planning indicator */}
          {status === "planning" && (
            <div className="animate-fade-in flex items-center gap-3 px-4 py-3 rounded border border-yellow-500/30 bg-yellow-500/5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs text-yellow-400 tracking-wider">
                ANALYZING GOAL — DECOMPOSING INTO SUB-TASKS...
              </span>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="animate-fade-in flex items-start gap-3 px-4 py-3 rounded border border-destructive/40 bg-destructive/10">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-destructive tracking-wider mb-0.5">AGENT ERROR</p>
                <p className="text-xs text-destructive/80">{error}</p>
              </div>
            </div>
          )}

          {/* Task decomposition list */}
          {tasks.length > 0 && (
            <TaskList
              tasks={tasks}
              taskStatuses={taskStatuses}
              activeTaskId={activeTaskId}
            />
          )}

          {/* Terminal execution output */}
          <TerminalOutput
            tasks={tasks}
            taskStatuses={taskStatuses}
            taskOutputs={taskOutputs}
            activeTaskId={activeTaskId}
          />

          {/* Completion message */}
          {status === "done" && (
            <div className="animate-fade-in flex items-center gap-3 px-4 py-3 rounded border border-primary/40 bg-primary/5 terminal-glow">
              <Trophy className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-bold text-primary tracking-wider text-glow">
                  MISSION ACCOMPLISHED
                </p>
                <p className="text-[11px] text-foreground/60 mt-0.5">
                  All {tasks.length} tasks completed successfully. Reset to run a new mission.
                </p>
              </div>
              <CircleCheck className="w-4 h-4 text-primary ml-auto" />
            </div>
          )}

          {/* Idle hero state */}
          {status === "idle" && (
            <div className="animate-fade-in text-center py-16">
              <div className="relative inline-block mb-6">
                <div className="w-16 h-16 rounded-full border border-primary/30 flex items-center justify-center mx-auto terminal-glow">
                  <div className="w-10 h-10 rounded-full border border-primary/60 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  </div>
                </div>
              </div>
              <h2 className="text-lg font-bold text-foreground/80 tracking-widest mb-2">
                AGENT STANDBY
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Enter any goal or objective above. The agent will automatically decompose it into
                actionable sub-tasks and execute each one step-by-step.
              </p>

              {/* Feature hints */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
                {[
                  { step: "01", label: "DEFINE GOAL", desc: "Describe any objective or task in natural language" },
                  { step: "02", label: "AUTO PLAN", desc: "Agent decomposes your goal into concrete sub-tasks" },
                  { step: "03", label: "EXECUTE", desc: "Each sub-task is executed sequentially with live output" },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="rounded border border-border bg-card/50 p-3 hover:border-primary/30 transition-colors"
                  >
                    <div className="text-[10px] text-primary/60 tracking-widest font-bold mb-1">
                      STEP {item.step}
                    </div>
                    <div className="text-xs font-semibold text-foreground/80 tracking-wider mb-1">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer status bar */}
      <footer className="border-t border-border bg-card/50 px-6 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              GLM 5.1
            </span>
            <span>|</span>
            <span>openai_chat_completions</span>
          </div>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            HARNESS AGENT © 2026
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
