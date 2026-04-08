
'use client';

import React, { useMemo } from 'react';
import DashboardQueryError from '@/components/DashboardQueryError';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, AreaChart, Area
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { LogOut } from 'lucide-react';

export interface DashboardQueryState<T> {
    queryName: string;
    status: 'ready' | 'error';
    data: T[];
}

export interface LearningCurvePoint {
    date: string;
    accuracy: number;
}

export interface LatencyPoint {
    name: string;
    ms: number;
}

export interface DistributionRecord {
    range: string;
    count: number;
}

export interface OrderedFatiguePoint {
    order: number;
    errorRate: number;
}

export const buildLearningCurveData = (records: LearningCurvePoint[]): LearningCurvePoint[] => (
    [...records].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
);

export const buildLatencyChartData = (records: LatencyPoint[]): LatencyPoint[] => {
    const byName = new Map(records.map((record) => [record.name, record]));

    return ['Correct', 'Incorrect'].map((name) => ({
        name,
        ms: byName.get(name)?.ms ?? 0,
    }));
};

export const buildFatigueChartData = (records: OrderedFatiguePoint[]): OrderedFatiguePoint[] => (
    [...records].sort((left, right) => left.order - right.order)
);

const parseDistributionRange = (range: string): number => {
    if (range === '100%') {
        return 100;
    }

    return Number.parseInt(range.split('-')[0] ?? '0', 10);
};

export const buildDistributionChartData = (records: DistributionRecord[]): DistributionRecord[] => (
    [...records].sort((left, right) => parseDistributionRange(left.range) - parseDistributionRange(right.range))
);

interface Props {
    learningData: DashboardQueryState<LearningCurvePoint>;
    latencyData: DashboardQueryState<LatencyPoint>;
    fatigueRaw: DashboardQueryState<OrderedFatiguePoint>;
    distributionRaw: DashboardQueryState<DistributionRecord>;
}

export default function DashboardClient({ learningData, latencyData, fatigueRaw, distributionRaw }: Props) {
    const { logout } = useAuth();
    const { showToast } = useToast();

    const learningCurve = useMemo(() => buildLearningCurveData(learningData.data), [learningData.data]);
    const latencyChart = useMemo(() => buildLatencyChartData(latencyData.data), [latencyData.data]);
    const fatigueChart = useMemo(() => buildFatigueChartData(fatigueRaw.data), [fatigueRaw.data]);
    const distributionChart = useMemo(
        () => buildDistributionChartData(distributionRaw.data),
        [distributionRaw.data]
    );

    const handleLogout = async () => {
        const result = await logout();

        if (!result.success) {
            showToast(result.error || 'Unable to sign out. Please try again.', 'error');
        }
    };

    return (
        <div className="flex flex-col gap-12">

            {/* Header with Logout */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>
                <button
                    onClick={() => {
                        void handleLogout();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>

            {/* 1. Learning Curve */}
            <div className="bg-white p-4 rounded shadow">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">The Learning Curve (Average Accuracy)</h2>
                <div className="h-96">
                    {learningData.status === 'error' ? (
                        <DashboardQueryError query={learningData.queryName} />
                    ) : learningCurve.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={learningCurve}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" label={{ value: 'Date', position: 'insideBottom', offset: -5 }} />
                                <YAxis label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                                <Tooltip />
                                <Area type="monotone" dataKey="accuracy" stroke="#8884d8" fill="#8884d8" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded">
                            <p>No data available yet.</p>
                            <p className="text-sm mt-2">Run quiz sessions to populate this chart.</p>
                        </div>
                    )}
                </div>
                <p className="text-sm text-gray-500 mt-2">Expectation: Starts low, increases over time as SRS reinforces memory.</p>
            </div>

            {/* 2. Fatigue Analysis */}
            <div className="bg-white p-4 rounded shadow">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Cognitive Fatigue (Error Rate by Question Order)</h2>
                <div className="h-96">
                    {fatigueRaw.status === 'error' ? (
                        <DashboardQueryError query={fatigueRaw.queryName} />
                    ) : fatigueChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={fatigueChart}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="order" label={{ value: 'Question Number', position: 'insideBottom', offset: -5 }} />
                                <YAxis label={{ value: 'Error Rate %', angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                <Line type="monotone" dataKey="errorRate" stroke="#ff7300" strokeWidth={3} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded">
                            <p>No data available yet.</p>
                            <p className="text-sm mt-2">Run more simulation quizzes to populate this chart.</p>
                        </div>
                    )}
                </div>
                <p className="text-sm text-gray-500 mt-2">Expectation: Error rate rises deeper into a user&apos;s daily simulation run.</p>
            </div>

            {/* 3. Response Latency */}
            <div className="bg-white p-4 rounded shadow">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Response Latency (Hesitation Analysis)</h2>
                <div className="h-96">
                    {latencyData.status === 'error' ? (
                        <DashboardQueryError query={latencyData.queryName} />
                    ) : latencyChart.some(x => x.ms > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={latencyChart}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis label={{ value: 'Milliseconds', angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="ms" fill="#82ca9d" barSize={80} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded">
                            Waiting for data...
                        </div>
                    )}
                </div>
                <p className="text-sm text-gray-500 mt-2">Expectation: Incorrect answers take longer (hesitation).</p>
            </div>

            {/* 4. Class Distribution */}
            <div className="bg-white p-4 rounded shadow">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Class Performance Distribution (Bell Curve)</h2>
                <div className="h-96">
                    {distributionRaw.status === 'error' ? (
                        <DashboardQueryError query={distributionRaw.queryName} />
                    ) : distributionChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={distributionChart}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="range" />
                                <YAxis label={{ value: 'User Count', angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded">
                            Not enough user data yet...
                        </div>
                    )}
                </div>
                <p className="text-sm text-gray-500 mt-2">Expectation: Normal distribution of per-user simulation accuracies.</p>
            </div>

        </div>
    );
}
