import Link from 'next/link';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { ChatWorkspace } from '@/components/chat/ChatWorkspace';

export default function ChatPage() {
  return (
    <main className="min-h-screen">
      <div className="site-container py-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200">
            <GraduationCap className="h-5 w-5 text-brand-400" />
            <p className="text-sm font-semibold">CoursePilot AI</p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to landing
          </Link>
        </header>

        <ChatWorkspace />
      </div>
    </main>
  );
}
