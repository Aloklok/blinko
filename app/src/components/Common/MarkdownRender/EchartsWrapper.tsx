import React, { useEffect, useRef } from 'react';
// import * as echarts from 'echarts'; // Removed static import

interface EchartsWrapperProps {
  options: string;
}

export const EchartsWrapper = ({ options }: EchartsWrapperProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    const initChart = async () => {
      if (!chartRef.current) return;

      const echarts = await import('echarts');

      if (!chartInstance.current && isMounted) {
        chartInstance.current = echarts.init(chartRef.current);
      }

      if (chartInstance.current && isMounted) {
        try {
          const parsedOptions = JSON.parse(options);
          chartInstance.current.setOption(parsedOptions);
        } catch (error) {
          console.error('Failed to parse echarts options:', error);
        }
      }
    };

    initChart();

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [options]);

  return (
    <div
      ref={chartRef}
      className="w-full h-96 my-4 rounded-lg border border-gray-200 dark:border-gray-800"
    ></div>
  );
};

export default EchartsWrapper;