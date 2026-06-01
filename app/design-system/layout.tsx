import type { ReactNode } from 'react';
import { Sidebar } from './_components/Sidebar.client';

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ds-layout flex min-h-screen max-w-[1200px] mx-auto pt-11 max-md:flex-col max-md:pt-0">
      <Sidebar />
      <main className="ds-prose flex-1 p-6 max-w-[720px] [&_a:not([class])]:underline [&_p]:mb-4 [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-primary-400 [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_li]:mb-1 [&_li]:leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_table]:mb-6 [&_table]:text-xs [&_th]:text-left [&_th]:py-2 [&_th]:px-3 [&_th]:border [&_th]:border-primary-border [&_th]:align-top [&_th]:leading-snug [&_th]:text-primary-500 [&_th]:text-xs [&_th]:tracking-[0.05em] [&_th]:bg-primary-quiet [&_th]:whitespace-nowrap [&_td]:text-left [&_td]:py-2 [&_td]:px-3 [&_td]:border [&_td]:border-primary-border [&_td]:align-top [&_td]:leading-snug [&_td_code]:text-xs [&_td_code]:text-primary-500 max-md:[&_table]:block max-md:[&_table]:overflow-x-auto">
        {children}
      </main>
    </div>
  );
}
