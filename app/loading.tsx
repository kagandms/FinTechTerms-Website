import Image from 'next/image';

export default function Loading() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="w-48 mx-auto flex flex-col items-center text-center">
                <div className="mb-4 flex justify-center animate-pulse">
                    <Image
                        src="/home-logo.png"
                        alt="FinTechTerms Logo"
                        width={120}
                        height={108}
                        className="w-24 h-auto object-contain drop-shadow-lg rounded-2xl"
                        priority
                    />
                </div>

                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full w-3/5 rounded-full animate-pulse bg-gradient-to-r from-primary-500 to-accent-500" />
                </div>
            </div>
        </div>
    );
}
