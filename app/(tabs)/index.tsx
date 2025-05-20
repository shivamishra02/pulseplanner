import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Checkbox } from 'expo-checkbox';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Theme setup with vibrant colors
const lightTheme = {
  background: '#f8f9fa',
  text: '#212529',
  button: '#4361ee',
  buttonText: '#ffffff',
  inputBackground: '#ffffff',
  helper: '#6c757d',
  taskBackground: '#e9ecef',
  priorityLow: '#4cc9f0',
  priorityMedium: '#f8961e',
  priorityHigh: '#f94144',
  editButton: '#4895ef',
  deleteButton: '#ef233c',
  modalBackground: 'rgba(255,255,255,0.95)',
};

const darkTheme = {
  background: '#121212',
  text: '#e9ecef',
  button: '#3a0ca3',
  buttonText: '#ffffff',
  inputBackground: '#1e1e1e',
  helper: '#adb5bd',
  taskBackground: '#2b2d42',
  priorityLow: '#4cc9f0',
  priorityMedium: '#f8961e',
  priorityHigh: '#f94144',
  editButton: '#4895ef',
  deleteButton: '#ef233c',
  modalBackground: 'rgba(30,30,30,0.95)',
};

const ThemeContext = React.createContext({
  theme: lightTheme,
  toggleTheme: () => {},
  isDark: false,
});

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const toggleTheme = () => setIsDark(!isDark);
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => React.useContext(ThemeContext);

type Task = {
  id: number;
  text: string;
  completed: boolean;
  priority: 'Low' | 'Medium' | 'High';
  category: string;
  reminderDate?: Date;
  notificationId?: string;
};

const PRIORITIES = ['Low', 'Medium', 'High'];
const CATEGORIES = ['Work', 'Personal', 'Shopping', 'Health', 'Other'];
const STORAGE_KEY = 'tasks';

function TaskApp() {
  const { theme, toggleTheme, isDark } = useTheme();

  const [task, setTask] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [category, setCategory] = useState('');
  const [reminderDate, setReminderDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Completed' | 'Pending'>('All');
  const [sortBy, setSortBy] = useState<'None' | 'Priority' | 'Date'>('None');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Load tasks from storage
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const savedTasks = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedTasks) {
          const parsedTasks = JSON.parse(savedTasks);
          const tasksWithDates = parsedTasks.map((task: any) => ({
            ...task,
            reminderDate: task.reminderDate ? new Date(task.reminderDate) : undefined,
          }));
          setTasks(tasksWithDates);
        }
      } catch (error) {
        console.error('Failed to load tasks', error);
      }
    };

    loadTasks();
  }, []);

  // Save tasks to storage
  useEffect(() => {
    const saveTasks = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (error) {
        console.error('Failed to save tasks', error);
      }
    };

    saveTasks();
  }, [tasks]);

  // Configure notifications
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Notifications permission is needed for reminders');
      }

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    })();
  }, []);

  const addTask = async () => {
    if (!task.trim()) {
      Alert.alert('Error', 'Task text cannot be empty');
      return;
    }

    const newTask: Task = {
      id: Date.now(),
      text: task.trim(),
      completed: false,
      priority,
      category: category.trim(),
      reminderDate,
    };

    try {
      if (reminderDate && reminderDate > new Date()) {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Task Reminder',
            body: task.trim(),
            data: { taskId: newTask.id },
          },
          trigger: {
            type: 'date',
            date: reminderDate,
          },
        });
        newTask.notificationId = notificationId;
      }

      setTasks([...tasks, newTask]);
      resetForm();
    } catch (error) {
      console.error('Error adding task:', error);
      Alert.alert('Error', 'Failed to add task');
    }
  };

  const updateTask = async () => {
    if (!editingTask || !task.trim()) return;

    try {
      // Cancel old notification if exists
      if (editingTask.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(editingTask.notificationId);
      }

      let notificationId;
      if (reminderDate && reminderDate > new Date()) {
        const newNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Task Reminder',
            body: task.trim(),
            data: { taskId: editingTask.id },
          },
          trigger: {
            type: 'date',
            date: reminderDate,
          },
        });
        notificationId = newNotificationId;
      }

      setTasks(tasks.map(t =>
        t.id === editingTask.id
          ? {
              ...t,
              text: task.trim(),
              priority,
              category: category.trim(),
              reminderDate,
              notificationId,
            }
          : t
      ));

      setEditingTask(null);
      resetForm();
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const resetForm = () => {
    setTask('');
    setCategory('');
    setPriority('Low');
    setReminderDate(undefined);
  };

  const toggleComplete = (id: number) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === id ? { ...t, completed: !t.completed } : t
      )
    );
  };

  const deleteTask = async (id: number) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (taskToDelete?.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(taskToDelete.notificationId);
    }
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const startEditing = (task: Task) => {
    setEditingTask(task);
    setTask(task.text);
    setPriority(task.priority);
    setCategory(task.category);
    setReminderDate(task.reminderDate);
  };

  const filteredTasks = tasks
    .filter(t => {
      if (filter === 'Completed') return t.completed;
      if (filter === 'Pending') return !t.completed;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'Priority') {
        const priorityOrder = { High: 3, Medium: 2, Low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      if (sortBy === 'Date') {
        return (a.reminderDate?.getTime() || 0) - (b.reminderDate?.getTime() || 0);
      }
      return 0;
    });

  const getPriorityColor = (priority: 'Low' | 'Medium' | 'High') => {
    switch (priority) {
      case 'High': return theme.priorityHigh;
      case 'Medium': return theme.priorityMedium;
      case 'Low': return theme.priorityLow;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Pulse Planner</Text>
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.themeButton, { backgroundColor: theme.button }]}
        >
          <Text style={{ color: theme.buttonText }}>
            {isDark ? '☀️' : '🌙'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Add a new task"
          placeholderTextColor={theme.helper}
          style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
          value={task}
          onChangeText={setTask}
          onSubmitEditing={editingTask ? updateTask : addTask}
        />
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: theme.button }]} 
          onPress={editingTask ? updateTask : addTask}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>
            {editingTask ? '✓' : '+'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        {PRIORITIES.map(p => (
          <TouchableOpacity
            key={p}
            onPress={() => setPriority(p as 'Low' | 'Medium' | 'High')}
            style={[
              styles.priorityButton,
              {
                backgroundColor: priority === p ? theme.button : theme.inputBackground,
                borderColor: getPriorityColor(p as 'Low' | 'Medium' | 'High'),
              },
            ]}
          >
            <Text style={{ color: priority === p ? theme.buttonText : theme.text }}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => setShowCategoryModal(true)}
          style={[styles.categoryButton, { backgroundColor: theme.inputBackground }]}
        >
          <Text style={{ color: theme.text }}>
            {category || 'Select Category'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={[styles.reminderButton, { backgroundColor: theme.inputBackground }]}
        >
          <Text style={{ color: theme.text }}>
            {reminderDate ? reminderDate.toLocaleString() : 'Set Reminder'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.modalBackground }]}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Category</Text>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat}
                onPress={() => {
                  setCategory(cat);
                  setShowCategoryModal(false);
                }}
                style={({ pressed }) => [
                  styles.categoryItem,
                  { 
                    backgroundColor: pressed ? theme.button : theme.inputBackground,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ color: theme.text }}>{cat}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowCategoryModal(false)}
              style={[styles.closeButton, { backgroundColor: theme.button }]}
            >
              <Text style={{ color: theme.buttonText }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={reminderDate || new Date()}
          mode="datetime"
          minimumDate={new Date()}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) setReminderDate(date);
          }}
          {...(Platform.OS === 'android' ? { is24Hour: true } : {})}
        />
      )}

      <View style={styles.filterRow}>
        <Text style={[styles.filterLabel, { color: theme.text }]}>Show:</Text>
        {['All', 'Completed', 'Pending'].map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f as 'All' | 'Completed' | 'Pending')}
            style={[
              styles.filterButton,
              { 
                backgroundColor: filter === f ? theme.button : theme.inputBackground,
              },
            ]}
          >
            <Text style={{ color: filter === f ? theme.buttonText : theme.text }}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filterRow}>
        <Text style={[styles.filterLabel, { color: theme.text }]}>Sort by:</Text>
        {['None', 'Priority', 'Date'].map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => setSortBy(s as 'None' | 'Priority' | 'Date')}
            style={[
              styles.filterButton,
              { 
                backgroundColor: sortBy === s ? theme.button : theme.inputBackground,
              },
            ]}
          >
            <Text style={{ color: sortBy === s ? theme.buttonText : theme.text }}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredTasks}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.taskItem, { backgroundColor: theme.taskBackground }]}>
            <Checkbox
              value={item.completed}
              onValueChange={() => toggleComplete(item.id)}
              color={item.completed ? theme.button : undefined}
            />
            <View style={styles.taskContent}>
              <Text
                style={[
                  styles.taskText,
                  { color: theme.text },
                  item.completed && { 
                    textDecorationLine: 'line-through', 
                    color: theme.helper 
                  },
                ]}
              >
                {item.text}
              </Text>
              <View style={styles.taskMeta}>
                <Text style={[styles.priorityBadge, { 
                  backgroundColor: getPriorityColor(item.priority),
                  color: '#fff',
                }]}>
                  {item.priority}
                </Text>
                {item.category && (
                  <Text style={[styles.categoryBadge, { color: theme.helper }]}>
                    {item.category}
                  </Text>
                )}
                {item.reminderDate && (
                  <Text style={[styles.reminderBadge, { color: theme.helper }]}>
                    ⏰ {item.reminderDate.toLocaleString()}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.taskActions}>
              <TouchableOpacity 
                onPress={() => startEditing(item)}
                style={[styles.actionButton, { backgroundColor: theme.editButton }]}
              >
                <Text style={{ color: '#fff' }}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => deleteTask(item.id)}
                style={[styles.actionButton, { backgroundColor: theme.deleteButton }]}
              >
                <Text style={{ color: '#fff' }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.helper }]}>
            No tasks found. Add one above!
          </Text>
        }
      />

      {editingTask && (
        <TouchableOpacity
          onPress={() => {
            setEditingTask(null);
            resetForm();
          }}
          style={[styles.cancelEditButton, { backgroundColor: theme.deleteButton }]}
        >
          <Text style={{ color: '#fff' }}>Cancel Edit</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <TaskApp />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    paddingHorizontal: 16, 
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold',
  },
  themeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: { 
    flexDirection: 'row', 
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  addButton: {
    width: 50,
    height: 50,
    marginLeft: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { 
    fontSize: 24,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priorityButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginRight: 8,
    alignItems: 'center',
  },
  reminderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  filterLabel: {
    marginRight: 10,
    fontWeight: 'bold',
    fontSize: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  taskItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 10,
    marginVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  taskContent: {
    flex: 1,
    marginLeft: 12,
  },
  taskText: {
    fontSize: 16,
    marginBottom: 6,
  },
  taskMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    fontSize: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  categoryBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    fontSize: 12,
    marginRight: 6,
    marginBottom: 4,
    backgroundColor: '#e9ecef',
  },
  reminderBadge: {
    fontSize: 12,
    marginBottom: 4,
  },
  taskActions: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  closeButton: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  cancelEditButton: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
    alignItems: 'center',
  },
});