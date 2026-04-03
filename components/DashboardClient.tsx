
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

interface LearningCurveRecord {
    created_at: string;
    is_correct: boolean;
}

interface LatencyRecord {
    is_correct: boolean;
    response_time_ms: number;
}

interface FatigueRecord {
    session_id: string | null;
    user_id: string | null;
    is_correct: boolean;
    created_at: string;
}

interface DistributionRecord {
    user_id: string | null;
    is_correct: boolean;
}

interface GroupedLearningPoint {
    date: string;
    total: number;
    correct: number;
}

interface OrderedFatiguePoint {
    order: number;
    total: number;
    incorrect: number;
}

interface AccuracyBin {
    range: string;
    count: number;
}

export const buildLearningCurveData = (records: LearningCurveRecord[]) => {
    const grouped: Record<string, GroupedLearningPoint> = {};
    records.forEach(item => {
        const date = item.created_at.split('T')[0] ?? item.created_at;
        if (!grouped[date]) grouped[date] = { date, total: 0, correct: 0 };
        grouped[date].total++;
        if (item.is_correct) grouped[date].correct++;
    });

    return Object.values(grouped)
        .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
        .map((group) => ({
            date: group.date,
            accuracy: (group.correct / group.total) * 100,
        }));
};

export const buildFatigueChartData = (records: FatigueRecord[]) => {
    if (!records.length) return [];

    const sessions: Record<string, FatigueRecord[]> = {};
    records.forEach(item => {
        if (!item.created_at) {
            return;
        }

        const day = item.created_at.split('T')[0] ?? item.created_at;
        const sessionKey = item.session_id
            || (item.user_id ? `${item.user_id}:${day}` : null);

        if (!sessionKey) {
            return;
        }

        if (!sessions[sessionKey]) sessions[sessionKey] = [];
        sessions[sessionKey].push(item);
    });

    const statsByOrder: Record<number, OrderedFatiguePoint> = {};

    Object.values(sessions).forEach((session) => {
        session.sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());

        session.forEach((attempt, index) => {
            const order = index + 1;
            if (order > 25) return;
            if (!statsByOrder[order]) statsByOrder[order] = { order, total: 0, incorrect: 0 };

            statsByOrder[order].total++;
            if (!attempt.is_correct) statsByOrder[order].incorrect++;
        });
    });

    return Object.values(statsByOrder).map((point) => ({
        order: point.order,
        errorRate: (point.incorrect / point.total) * 100
    }));
};

export const buildDistributionChartData = (records: DistributionRecord[]): AccuracyBin[] => {
    if (!records.length) return [];

    const attemptsByUser: Record<string, { total: number; correct: number }> = {};
    records.forEach((attempt) => {
        if (!attempt.user_id) {
            return;
        }

        const userKey = attempt.user_id;
        if (!attemptsByUser[userKey]) {
            attemptsByUser[userKey] = { total: 0, correct: 0 };
        }

        attemptsByUser[userKey].total += 1;
        if (attempt.is_correct) {
            attemptsByUser[userKey].correct += 1;
        }
    });

    const studentAccuracies: number[] = Object.values(attemptsByUser).map((userStats) => (
        userStats.total > 0
            ? (userStats.correct / userStats.total) * 100
            : 0
    ));

    const bins: Record<number, number> = {};
    for (let i = 0; i < 100; i += 5) bins[i] = 0;
    bins[100] = 0;

    studentAccuracies.forEach((accuracy) => {
        if (accuracy === 100) {
            bins[100] = (bins[100] || 0) + 1;
            return;
        }

        const bin = Math.floor(accuracy / 5) * 5;
        bins[bin] = (bins[bin] || 0) + 1;
    });

    return Object.entries(bins).map(([binKey, count]) => {
        const numericBin = Number.parseInt(binKey, 10);

        if (numericBin === 100) {
            return { range: '100%', count };
        }

        return {
            range: `${numericBin}-${numericBin + 5}%`,
            count,
        };
    });
};

interface Props {
    learningData: DashboardQueryState<LearningCurveRecord>;
    latencyData: DashboardQueryState<LatencyRecord>;
    fatigueRaw: DashboardQueryState<FatigueRecord>;
    distributionRaw: DashboardQueryState<DistributionRecord>;
}

export default function DashboardClient({ learningData, latencyData, fatigueRaw, distributionRaw }: Props) {
    const { logout } = useAuth();
    const { showToast } = useToast();

    // 1. Process Learning Curve (Group by Date)
    const learningCurve = useMemo(() => buildLearningCurveData(learningData.data), [learningData.data]);

    // 2. Process Latency (Correct vs Incorrect)
    const latencyChart = useMemo(() => {
        let corrSum = 0, corrCount = 0;
        let incSum = 0, incCount = 0;

        latencyData.data.forEach(item => {
            if (item.is_correct) {
                corrSum += item.response_time_ms;
                corrCount++;
            } else {
                incSum += item.response_time_ms;
                incCount++;
            }
        });

        return [
            { name: 'Correct', ms: corrCount ? Math.round(corrSum / corrCount) : 0 },
            { name: 'Incorrect', ms: incCount ? Math.round(incSum / incCount) : 0 },
        ];
    }, [latencyData.data]);

    // 3. Process Fatigue (Group by attempt order within a user-day run)
    const fatigueChart = useMemo(() => buildFatigueChartData(fatigueRaw.data), [fatigueRaw.data]);

    // 4. Process Class Distribution (Accuracy per user)
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
