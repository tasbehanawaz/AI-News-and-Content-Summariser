'use client';

import { useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select, Switch, Button, Chip, Box, TextField, Alert, Snackbar } from '@mui/material';

const TOPICS = [
  'Technology',
  'Business',
  'Science',
  'Health',
  'Sports',
  'Entertainment',
  'Politics',
  'World News'
] as const;

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
] as const;

interface NewsletterPreferencesProps {
  userId: string;
  initialPreferences?: {
    email: string;
    topics: string[];
    frequency: 'daily' | 'weekly';
    time: string;
    days: string[];
    notificationMethod: 'email' | 'sms' | 'both';
    enabled: boolean;
  };
}

export default function NewsletterPreferences({ userId, initialPreferences }: NewsletterPreferencesProps) {
  const [preferences, setPreferences] = useState(initialPreferences || {
    email: '',
    topics: [] as string[],
    frequency: 'daily',
    time: '09:00',
    days: ['Monday'],
    notificationMethod: 'email',
    enabled: false
  });

  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePreferences = () => {
    if (!preferences.email || !validateEmail(preferences.email)) {
      setSnackbar({
        open: true,
        message: 'Please enter a valid email address',
        severity: 'error'
      });
      return false;
    }

    if (preferences.topics.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select at least one topic',
        severity: 'error'
      });
      return false;
    }

    if (preferences.frequency === 'weekly' && preferences.days.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select at least one day for weekly delivery',
        severity: 'error'
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validatePreferences()) {
      return;
    }

    setLoading(true);
    try {
      // Create or update user first
      const userResponse = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: userId,
          email: preferences.email,
        }),
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(errorData.error || 'Failed to save user');
      }

      // Then save newsletter preferences
      const response = await fetch('/api/newsletter/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          topics: preferences.topics,
          frequency: preferences.frequency,
          time: preferences.time,
          days: preferences.days,
          notificationMethod: preferences.notificationMethod,
          enabled: preferences.enabled
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save preferences');
      }

      setSnackbar({
        open: true,
        message: 'Newsletter preferences saved successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to save preferences',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-gray-800/50 rounded-2xl shadow-xl p-8 backdrop-blur-lg mt-8 border border-gray-200/30 dark:border-indigo-900/30">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">Newsletter Preferences</h2>
      
      <div className="space-y-6">
        {/* Email Input */}
        <div>
          <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-200">Email Address</h3>
          <TextField
            type="email"
            value={preferences.email}
            onChange={(e) => setPreferences({ ...preferences, email: e.target.value })}
            fullWidth
            required
            placeholder="Enter your email address"
            error={preferences.email !== '' && !validateEmail(preferences.email)}
            helperText={preferences.email !== '' && !validateEmail(preferences.email) ? 'Please enter a valid email address' : ''}
          />
        </div>

        {/* Topics Selection */}
        <div>
          <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-200">
            Topics of Interest
            <span className="text-sm text-gray-500 ml-2">(Select at least one)</span>
          </h3>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {TOPICS.map((topic) => (
              <Chip
                key={topic}
                label={topic}
                onClick={() => {
                  const newTopics = preferences.topics.includes(topic)
                    ? preferences.topics.filter(t => t !== topic)
                    : [...preferences.topics, topic];
                  setPreferences({ ...preferences, topics: newTopics });
                }}
                color={preferences.topics.includes(topic) ? "primary" : "default"}
                className="m-1"
              />
            ))}
          </Box>
        </div>

        {/* Frequency Selection */}
        <FormControl fullWidth>
          <InputLabel>Frequency</InputLabel>
          <Select
            value={preferences.frequency}
            label="Frequency"
            onChange={(e) => setPreferences({ ...preferences, frequency: e.target.value as 'daily' | 'weekly' })}
          >
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
          </Select>
        </FormControl>

        {/* Time Selection */}
        <div>
          <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-200">Delivery Time</h3>
          <TextField
            type="time"
            value={preferences.time}
            onChange={(e) => setPreferences({ ...preferences, time: e.target.value })}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              step: 300, // 5 min
            }}
          />
        </div>

        {/* Days Selection (for weekly) */}
        {preferences.frequency === 'weekly' && (
          <div>
            <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-200">
              Delivery Days
              <span className="text-sm text-gray-500 ml-2">(Select at least one)</span>
            </h3>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {DAYS.map((day) => (
                <Chip
                  key={day}
                  label={day}
                  onClick={() => {
                    const newDays = preferences.days.includes(day)
                      ? preferences.days.filter(d => d !== day)
                      : [...preferences.days, day];
                    setPreferences({ ...preferences, days: newDays });
                  }}
                  color={preferences.days.includes(day) ? "primary" : "default"}
                  className="m-1"
                />
              ))}
            </Box>
          </div>
        )}

        {/* Notification Method */}
        <FormControl fullWidth>
          <InputLabel>Notification Method</InputLabel>
          <Select
            value={preferences.notificationMethod}
            label="Notification Method"
            onChange={(e) => setPreferences({ ...preferences, notificationMethod: e.target.value as 'email' | 'sms' | 'both' })}
          >
            <MenuItem value="email">Email</MenuItem>
            <MenuItem value="sms">SMS</MenuItem>
            <MenuItem value="both">Both</MenuItem>
          </Select>
        </FormControl>

        {/* Enable/Disable Switch */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium text-gray-700 dark:text-gray-200">Enable Newsletter</span>
          <Switch
            checked={preferences.enabled}
            onChange={(e) => setPreferences({ ...preferences, enabled: e.target.checked })}
            color="primary"
          />
        </div>

        {/* Save Button */}
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-6"
        >
          {loading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
} 