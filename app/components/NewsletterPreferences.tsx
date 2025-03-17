'use client';

import { useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select, Switch, Button, Chip, Box, TextField } from '@mui/material';

const TOPICS = [
  'Technology',
  'Business',
  'Science',
  'Health',
  'Sports',
  'Entertainment',
  'Politics',
  'World News'
];

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

interface NewsletterPreferencesProps {
  userId: string;
}

export default function NewsletterPreferences({ userId }: NewsletterPreferencesProps) {
  const [preferences, setPreferences] = useState({
    topics: [] as string[],
    frequency: 'daily',
    time: '09:00',
    days: ['Monday'],
    notificationMethod: 'email',
    enabled: false
  });

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/newsletter/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...preferences
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      alert('Newsletter preferences saved successfully!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences. Please try again.');
    }
  };

  return (
    <div className="bg-white/80 dark:bg-gray-800/50 rounded-2xl shadow-xl p-8 backdrop-blur-lg mt-8 border border-gray-200/30 dark:border-indigo-900/30">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">Newsletter Preferences</h2>
      
      <div className="space-y-6">
        {/* Topics Selection */}
        <div>
          <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-200">Topics of Interest</h3>
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
            onChange={(e) => setPreferences({ ...preferences, frequency: e.target.value as string })}
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
            <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-200">Delivery Days</h3>
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
            onChange={(e) => setPreferences({ ...preferences, notificationMethod: e.target.value as string })}
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
          className="w-full mt-6"
        >
          Save Preferences
        </Button>
      </div>
    </div>
  );
} 