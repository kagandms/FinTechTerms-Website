export default function Loading() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="text-center">
                {/* Animated logo pulse */}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0e3b5e] to-blue-600 mb-6 shadow-lg animate-pulse">
                    <span className="text-2xl font-bold text-white">FT</span>
                </div>

                {/* Loading bar using Tailwind animation */}
                <div className="w-48 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto overflow-hidden">
                    <div
                        className="h-full rounded-full animate-pulse"
                        style={{
                            background: 'linear-gradient(90deg, #0e3b5e, #f59e0b)',
                            width: '60%',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
