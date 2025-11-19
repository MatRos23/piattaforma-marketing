import React from 'react';

const SortIndicatorIcon = ({
    active = false,
    direction = 'asc',
    className = '',
    activeClassName = 'text-white',
    inactiveClassName = 'text-white/40'
}) => {
    const combinedClass = `h-3 w-3 transition-colors ${className} ${active ? activeClassName : inactiveClassName}`;

    if (!active) {
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 12 12"
                className={combinedClass}
            >
                <path
                    d="M3 4l3-3 3 3"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M3 8l3 3 3-3"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }

    const path = direction === 'asc'
        ? 'M3 8l3-3 3 3'
        : 'M3 4l3 3 3-3';

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 12 12"
            className={combinedClass}
        >
            <path
                d={path}
                stroke="currentColor"
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

export default SortIndicatorIcon;
