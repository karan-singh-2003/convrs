import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import SettingsChildrenLayout from '@/ui/workspaces/SettingsChildrentLayout'
const Theme = () => {
    const { theme, setTheme } = useTheme()
    const [selectedTheme, setSelectedTheme] = useState<string | null>(null)

    useEffect(() => {
        // Sync with system or saved theme on first render
        if (theme) setSelectedTheme(theme)
    }, [theme])

    const handleThemeSelect = (theme: string) => {
        setSelectedTheme(theme)
        setTheme(theme)
    }
    return (

        <SettingsChildrenLayout title='   Theme' description='   Customize your workspace appearance' className='w-full px-6'>
            <div className="grid grid-cols-2 gap-4 w-full max-w-[450px] mt-2">
                {/* Light Theme Box */}
                <div
                    className={`bg-gray-200 dark:bg-[#2e2e2eaf]  p-4 rounded-none cursor-pointer flex justify-center transition hover:bg-gray-300 dark:hover:bg-[#333333] ${selectedTheme === 'light'
                        ? 'ring-1 ring-black/70 dark:ring-white/50'
                        : ''
                        }`}
                    onClick={() => handleThemeSelect('light')}
                >
                    <div className="border border-gray-300 dark:border-white/30 rounded-none overflow-hidden w-32 h-24 bg-white dark:bg-[#75757523]">
                        <div className="p-2">
                            <div className="h-2 w-1/2 bg-gray-300 dark:bg-gray-500 rounded mb-1" />
                            <div className="h-1 w-3/4 bg-gray-200 dark:bg-gray-600 rounded mb-1" />
                            <div className="h-1 w-2/3 bg-gray-200 dark:bg-gray-600 rounded mb-1" />
                            <div className="h-1 w-1/2 bg-gray-200 dark:bg-gray-600 rounded" />
                        </div>
                    </div>
                </div>

                {/* Dark Theme Box */}
                <div
                    className={`bg-gray-200 dark:bg-[#2a2a2ad5] p-4 rounded-none  cursor-pointer flex justify-center transition hover:bg-gray-300 dark:hover:bg-[#333333] ${selectedTheme === 'dark'
                        ? 'ring-1 ring-black/70 dark:ring-white/40'
                        : ''
                        }`}
                    onClick={() => handleThemeSelect('dark')}
                >
                    <div className="border border-gray-700 dark:border-white/20 rounded-none overflow-hidden w-32 h-24 bg-gray-900 dark:bg-[#0b0b0b]">
                        <div className="p-2">
                            <div className="h-2 w-1/2 bg-gray-700 dark:bg-gray-500 rounded mb-1" />
                            <div className="h-1 w-3/4 bg-gray-800 dark:bg-gray-600 rounded mb-1" />
                            <div className="h-1 w-2/3 bg-gray-800 dark:bg-gray-600 rounded mb-1" />
                            <div className="h-1 w-1/2 bg-gray-800 dark:bg-gray-600 rounded" />
                        </div>
                    </div>
                </div>

                <div className="text-center text-sm font-medium text-black/70 dark:text-white/80">
                    Light
                </div>
                <div className="text-center text-sm font-medium text-black/70 dark:text-white/80">
                    Dark
                </div>
            </div>
        </SettingsChildrenLayout>

    )
}

export default Theme