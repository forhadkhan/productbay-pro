import React from 'react';
import { __ } from '@wordpress/i18n';

/**
 * SectionHeading Component (Duplicated from Free for self-containment)
 */
interface SectionHeadingProps {
    title: string;
    description?: string;
}

const SectionHeading = ({ title, description }: SectionHeadingProps) => (
    <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900 m-0">
            {title}
        </h3>
        {description && (
            <p className="mt-1 text-sm text-gray-500 m-0">
                {description}
            </p>
        )}
    </div>
);

export default SectionHeading;
