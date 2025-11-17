        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
            <div 
                className={`h-full rounded-full bg-gradient-to-r ${getGradient()} transition-all duration-700 relative overflow-hidden`} 
                style={{ width: `${displayPercentage}%` }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
            </div>
            {showOverrun && percentage > 100 && (
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                    <span className="text-[10px] font-bold text-red-700 drop-shadow-lg">
                        +{(percentage - 100).toFixed(0)}%
                    </span>
                </div>
            )}
        </div>