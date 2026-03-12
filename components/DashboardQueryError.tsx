'use client';

interface DashboardQueryErrorProps {
    query: string;
}

export default function DashboardQueryError({ query }: DashboardQueryErrorProps) {
    return (
        <div className="flex h-full flex-col items-center justify-center rounded border border-dashed border-red-300 bg-red-50 p-4 text-center text-red-600">
            <p className="font-semibold">{query}</p>
            <p className="mt-2 text-sm">This dashboard query failed. Please try again later.</p>
        </div>
    );
}
