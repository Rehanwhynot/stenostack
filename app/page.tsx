import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">StenoStack</h1>
          <Button variant="outline">Login</Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-3xl font-semibold mb-4">Your Lectures</h2>
          <p className="text-muted-foreground mb-8">Upload your first lecture to get started</p>
          <Button className="px-8 py-6 text-lg">
            + New Lecture
          </Button>
        </div>
      </main>
    </div>
  )
}