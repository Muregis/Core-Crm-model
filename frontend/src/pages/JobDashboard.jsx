import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import LoadingSpinner from '../components/LoadingSpinner';

const JobDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({});
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthStore();

  const fetchJobsData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [jobsRes, statsRes, workersRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/jobs`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/jobs/stats`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/jobs/workers/active`, { headers })
      ]);
      setJobs(jobsRes.data.data || []);
      setStats(statsRes.data.data || {});
      setWorkers(workersRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch job dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobsData();
    const interval = setInterval(fetchJobsData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async (type, jobId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${import.meta.env.VITE_API_URL}/jobs/${type}/${jobId}/retry`, {}, { headers });
      fetchJobsData();
    } catch (error) {
      console.error('Failed to retry job:', error);
      alert('Failed to retry job');
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Background Jobs</h1>
        <p className="mt-1 text-sm text-gray-500">Monitor asynchronous tasks and queues</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Workers Panel */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-5">
          <dt className="text-sm font-medium text-gray-500 truncate">Active Workers</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{workers.length}</dd>
          <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            {workers.map((w, i) => (
              <li key={i}>{w.queue} queue - {w.id}</li>
            ))}
          </ul>
        </div>

        {/* Stats Panel */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-5 col-span-1 sm:col-span-2 lg:col-span-2">
          <dt className="text-sm font-medium text-gray-500 mb-4">Queue Statistics</dt>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(stats).map(([queueName, counts]) => (
              <div key={queueName} className="space-y-1">
                <p className="font-semibold text-gray-700 dark:text-gray-300 capitalize">{queueName}</p>
                <div className="text-xs text-gray-500">
                  <p>Waiting: {counts.waiting || 0}</p>
                  <p>Active: {counts.active || 0}</p>
                  <p>Completed: {counts.completed || 0}</p>
                  <p className="text-red-500">Failed: {counts.failed || 0}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Recent Jobs</h3>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempts</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white" title={job.job_id}>
                    {job.job_id?.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{job.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${job.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        job.status === 'failed' ? 'bg-red-100 text-red-800' : 
                        job.status === 'active' ? 'bg-blue-100 text-blue-800' : 
                        'bg-yellow-100 text-yellow-800'}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{job.attempts}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {job.status === 'failed' && (
                      <button 
                        onClick={() => handleRetry(job.type, job.job_id)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">No jobs found in audit history</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JobDashboard;
