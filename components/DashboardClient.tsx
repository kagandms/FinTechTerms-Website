
'use client';

import React, { useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, AreaChart, Area, ComposedChart
} from 'recharts';

interface Props {
    learningData: any[];
    latencyData: any[];
    fatigueRaw: any[];
    distributionRaw: any[];
}

export default function DashboardClient({ learningData, latencyData, fatigueRaw, distributionRaw }: Props) {

    // 1. Process Learning Curve (Group by Date)
    const learningCurve = useMemo(() => {
        const grouped: any = {};
        learningData.forEach(item => {
            // item.created_at is ISO string. Take YYYY-MM-DD
            const date = item.created_at.split('T')[0];
            if (!grouped[date]) grouped[date] = { date, total: 0, correct: 0 };
            grouped[date].total++;
            if (item.is_correct) grouped[date].correct++;
        });

        // Sort by date and calculate %
        return Object.values(grouped)
            // @ts-ignore
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((g: any, index) => ({
                day: index + 1, // Day 1, Day 2...
                date: g.date,
                accuracy: (g.correct / g.total) * 100
            }));
    }, [learningData]);

    // 2. Process Latency (Correct vs Incorrect)
    const latencyChart = useMemo(() => {
        let corrSum = 0, corrCount = 0;
        let incSum = 0, incCount = 0;

        latencyData.forEach(item => {
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
    }, [latencyData]);

    // 3. Process Fatigue (Group by order in session)
    const fatigueChart = useMemo(() => {
        // We need session_id to group. If missing, we can't do it accurately.
        // If not present, we return empty.
        if (!fatigueRaw.length || !fatigueRaw[0].session_id) return [];

        const sessions: any = {};
        fatigueRaw.forEach(item => {
            if (!sessions[item.session_id]) sessions[item.session_id] = [];
            sessions[item.session_id].push(item);
        });

        // Sort each session by created_at and assign index
        const statsByOrder: any = {}; // { 1: {total:0, incorrect:0}, 2: ... }

        Object.values(sessions).forEach((session: any) => {
            // Sort by time
            session.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            session.forEach((attempt: any, index: number) => {
                const order = index + 1;
                if (order > 25) return; // Limit to 25 questions
                if (!statsByOrder[order]) statsByOrder[order] = { order, total: 0, incorrect: 0 };

                statsByOrder[order].total++;
                if (!attempt.is_correct) statsByOrder[order].incorrect++;
            });
        });

        return Object.values(statsByOrder).map((s: any) => ({
            order: s.order,
            errorRate: (s.incorrect / s.total) * 100
        }));

    }, [fatigueRaw]);

    // 4. Process Class Distribution (Accuracy per student)
    const distributionChart = useMemo(() => {
        if (!distributionRaw.length) return [];

        const studentAccuracies: number[] = distributionRaw.map((session: any) => {
            // Each row is a session with nested quiz_attempts
            const attempts = session.quiz_attempts || [];
            if (!attempts.length) return 0;
            const correct = attempts.filter((a: any) => a.is_correct).length;
            return (correct / attempts.length) * 100;
        });

        // Binning for Bell Curve (5% intervals)
        const bins: any = {};
        for (let i = 0; i <= 100; i += 5) bins[i] = 0;

        studentAccuracies.forEach(acc => {
            const bin = Math.floor(acc / 5) * 5;
            bins[bin] = (bins[bin] || 0) + 1;
        });

        return Object.keys(bins).map(bin => ({
            range: `${bin}-${parseInt(bin) + 5}%`,
            count: bins[bin]
        }));
    }, [distributionRaw]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 1. Learning Curve */}
            <div className="bg-white p-4 rounded shadow">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">The Learning Curve (Average Accuracy)</h2>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={learningCurve}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                            <YAxis label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                            <Tooltip />
                            <Area type="monotone" dataKey="accuracy" stroke="#8884d8" fill="#8884d8" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-sm text-gray-500 mt-2">Expectation: Starts low, increases over time as SRS reinforces memory.</p>
            </div>

            {/* 2. Fatigue Analysis */}
            <div className="bg-white p-4 rounded shadow">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Cognitive Fatigue (Error Rate by Question Order)</h2>
                {fatigueChart.length > 0 ? (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={fatigueChart}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="order" label={{ value: 'Question Number', position: 'insideBottom', offset: -5 }} />
                                <YAxis label={{ value: 'Error Rate %', angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                <Line type="monotone" dataKey="errorRate" stroke="#ff7300" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-64 flex items-center justify-center text-red-500 border border-dashed border-red-300">
                        Data missing session_id link. Please run SQL migration.
                    </div>
                )}
                <p className="text-sm text-gray-500 mt-2">Expectation: Error rate spikes after ~15th question.</p>
            </div>

            {/* 3. Response Latency */}
            <div className="bg-white p-4 rounded shadow">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Response Latency (Hesitation Analysis)</h2>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={latencyChart}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis label={{ value: 'Milliseconds', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="ms" fill="#82ca9d" barSize={50} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-sm text-gray-500 mt-2">Expectation: Incorrect answers take longer (hesitation).</p>
            </div>

            {/* 4. Class Distribution */}
            <div className="bg-white p-4 rounded shadow">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Class Performance Distribution (Bell Curve)</h2>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distributionChart}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="range" />
                            <YAxis label={{ value: 'Student Count', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#8884d8" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-sm text-gray-500 mt-2">Expectation: Normal distribution of student accuracies.</p>
            </div>

        </div>
    );
}
