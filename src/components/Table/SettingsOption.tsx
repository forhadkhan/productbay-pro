import { cn } from '@/utils/cn';
import { ReactNode } from 'react';

interface SettingsOptionProps {
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
}

export const SettingsOption = ({
    title,
    description,
    children,
    className
}: SettingsOptionProps) => {
    return (
        <div className={cn("flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 px-4 py-2 rounded-md m-0", className)}>
            <div>
                <label className="text-sm font-medium text-gray-900 block">
                    {title}
                </label>
                {description && (
                    <p className="text-xs text-gray-500 py-2 m-0">
                        {description}
                    </p>
                )}
            </div>
            {children}
        </div>
    );
};

export default SettingsOption;
