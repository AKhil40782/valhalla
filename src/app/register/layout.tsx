export default function UserLayout({ children }: { children: React.ReactNode }) {
    // This layout has NO sidebar - completely separate from bank portal
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {children}
        </div>
    );
}
