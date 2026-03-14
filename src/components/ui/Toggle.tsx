import { cva, type VariantProps } from 'class-variance-authority';
import { InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

const toggleContainerVariants = cva(
    'relative inline-flex items-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
    {
        variants: {
            size: {
                default: 'h-6',
                lg: 'h-7',
                sm: 'h-5',
                xs: 'h-4',
            },
        },
        defaultVariants: {
            size: 'default',
        },
    }
);

const toggleSwitchVariants = cva(
    'bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:bg-white after:border-gray-300 after:border after:rounded-full after:transition-all peer-checked:bg-blue-600',
    {
        variants: {
            size: {
                default: 'w-11 h-6 after:top-[2px] after:left-[2px] after:h-5 after:w-5',
                lg: 'w-14 h-7 after:top-[2px] after:left-[2px] after:h-6 after:w-6',
                sm: 'w-9 h-5 after:top-[2px] after:left-[2px] after:h-4 after:w-4',
                xs: 'w-7 h-4 after:top-[2px] after:left-[2px] after:h-3 after:w-3',
            },
        },
        defaultVariants: {
            size: 'default',
        },
    }
);

export interface ToggleProps
    extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof toggleContainerVariants> {
    label?: string;
}

export const Toggle = ({ className, size, label, title, ...props }: ToggleProps) => (
    <label
        className={cn(toggleContainerVariants({ size }), className)}
        title={title}
    >
        <input
            type="checkbox"
            className="sr-only peer"
            {...props}
        />
        <div className={cn(toggleSwitchVariants({ size }))}></div>
        {label && (
            <span className="ml-3 text-sm font-medium text-gray-900">
                {label}
            </span>
        )}
    </label>
);

export default Toggle;
