import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  BookOpen,
  Users,
  Clock,
  Star,
  Filter,
  Search,
  Plus,
  Calendar,
  User,
  ChevronRight,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { mockCourses } from '../../utils/mockData';
import { eventBus, EVENTS } from '../../utils/eventBus';
import toast from 'react-hot-toast';

const CourseList = () => {
  const { user } = useSelector((state) => state.auth);
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [courseRatings, setCourseRatings] = useState({});
  const [pendingEnrollments, setPendingEnrollments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCourses();
    loadCourseRatings();
    loadPendingEnrollments();

    // Listen for real-time updates
    const handleCourseCreated = (newCourse) => {
      if (user?.role === 'instructor' && newCourse.instructorId === user.id) {
        loadCourses(); // Reload courses to show the new one
      }
    };

    const handleCourseApproved = (approvedCourse) => {
      loadCourses(); // Reload courses to show approved course
      toast.success(`Course "${approvedCourse.title}" has been approved and is now available!`);
    };

    const handleEnrollmentApproved = (enrollment) => {
      if (user?.role === 'student' && enrollment.studentId === user.id) {
        loadCourses(); // Reload to show newly accessible course
        toast.success(`You have been enrolled in "${enrollment.courseName}"!`);
      }
    };

    eventBus.on(EVENTS.COURSE_CREATED, handleCourseCreated);
    eventBus.on(EVENTS.COURSE_APPROVED, handleCourseApproved);
    eventBus.on(EVENTS.ENROLLMENT_APPROVED, handleEnrollmentApproved);

    return () => {
      eventBus.off(EVENTS.COURSE_CREATED, handleCourseCreated);
      eventBus.off(EVENTS.COURSE_APPROVED, handleCourseApproved);
      eventBus.off(EVENTS.ENROLLMENT_APPROVED, handleEnrollmentApproved);
    };
  }, [user]);

  // FIXED: Enhanced useEffect with proper dependencies and debouncing
  useEffect(() => {
    // Add debouncing for search to improve performance
    const timeoutId = setTimeout(() => {
      filterCourses();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [courses, searchTerm, selectedCategory, selectedLevel]);

  const loadCourses = () => {
    setIsLoading(true);
    
    try {
      // Load courses from localStorage (for newly created courses) and merge with mock data
      const storedCourses = JSON.parse(localStorage.getItem('courses') || '[]');
      const pendingCourses = JSON.parse(localStorage.getItem('pendingCourses') || '[]');
      
      let allCourses = [...mockCourses, ...storedCourses];
      
      // For instructors, also show their pending courses
      if (user?.role === 'instructor') {
        const instructorPendingCourses = pendingCourses.filter(course => course.instructorId === user.id);
        allCourses = [...allCourses, ...instructorPendingCourses];
      }
      
      // Filter courses based on user role
      let userCourses = allCourses;
      
      if (user?.role === 'instructor') {
        // Instructors only see courses they created/own
        userCourses = allCourses.filter(course => course.instructorId === user.id);
      } else if (user?.role === 'student') {
        // Students see all active courses, with enrollment status
        userCourses = allCourses.filter(course => course.status === 'active');
        
        // Check approved enrollments to update user's enrolled courses
        const approvedEnrollments = JSON.parse(localStorage.getItem('approvedEnrollments') || '[]');
        const userApprovedEnrollments = approvedEnrollments.filter(enrollment => enrollment.studentId === user.id);
        
        // Update user's enrolled courses based on approved enrollments
        if (userApprovedEnrollments.length > 0) {
          const enrolledCourseIds = userApprovedEnrollments.map(enrollment => enrollment.courseId);
          userCourses = userCourses.map(course => ({
            ...course,
            isUserEnrolled: enrolledCourseIds.includes(course.id) || (user.enrolledCourses || []).includes(course.id)
          }));
        } else {
          userCourses = userCourses.map(course => ({
            ...course,
            isUserEnrolled: (user.enrolledCourses || []).includes(course.id)
          }));
        }
      }
      
      console.log('Loaded courses:', userCourses); // Debug log
      setCourses(userCourses);
    } catch (error) {
      console.error('Error loading courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCourseRatings = () => {
    try {
      const ratings = JSON.parse(localStorage.getItem('courseRatings') || '{}');
      const ratingsMap = {};
      
      Object.values(ratings).forEach(rating => {
        if (!ratingsMap[rating.courseId]) {
          ratingsMap[rating.courseId] = { total: 0, count: 0 };
        }
        ratingsMap[rating.courseId].total += rating.rating;
        ratingsMap[rating.courseId].count += 1;
      });
      
      // Calculate averages
      Object.keys(ratingsMap).forEach(courseId => {
        ratingsMap[courseId].average = ratingsMap[courseId].total / ratingsMap[courseId].count;
      });
      
      setCourseRatings(ratingsMap);
    } catch (error) {
      console.error('Error loading course ratings:', error);
    }
  };

  const loadPendingEnrollments = () => {
    try {
      const pending = JSON.parse(localStorage.getItem('pendingEnrollments') || '[]');
      setPendingEnrollments(pending);
    } catch (error) {
      console.error('Error loading pending enrollments:', error);
    }
  };

  // FIXED: Enhanced filterCourses function with better search logic and null checks
  const filterCourses = () => {
    console.log('Filtering courses...', { searchTerm, selectedCategory, selectedLevel, totalCourses: courses.length }); // Debug log
    
    if (!Array.isArray(courses) || courses.length === 0) {
      console.log('No courses to filter');
      setFilteredCourses([]);
      return;
    }

    let filtered = [...courses]; // Create a copy to avoid mutation

    // Search filter - Enhanced with more comprehensive search and null checks
    if (searchTerm && searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase().trim();
      console.log('Searching for:', searchLower); // Debug log
      
      filtered = filtered.filter(course => {
        // Add null checks for all fields
        const titleMatch = course.title ? course.title.toLowerCase().includes(searchLower) : false;
        const descMatch = course.description ? course.description.toLowerCase().includes(searchLower) : false;
        const instructorMatch = course.instructor ? course.instructor.toLowerCase().includes(searchLower) : false;
        const categoryMatch = course.category ? course.category.toLowerCase().includes(searchLower) : false;
        
        const match = titleMatch || descMatch || instructorMatch || categoryMatch;
        console.log(`Course ${course.id}: ${match ? 'MATCH' : 'NO MATCH'}`, { titleMatch, descMatch, instructorMatch, categoryMatch });
        
        return match;
      });
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(course => course.category === selectedCategory);
    }

    // Level filter
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(course => course.level === selectedLevel);
    }

    console.log('Filtered courses:', filtered.length); // Debug log
    setFilteredCourses(filtered);
  };

  // FIXED: Enhanced search input handler with immediate feedback
  const handleSearchChange = (e) => {
    const value = e.target.value;
    console.log('Search input changed:', value); // Debug log
    setSearchTerm(value);
  };

  // FIXED: Clear search function
  const handleClearSearch = () => {
    console.log('Clearing search'); // Debug log
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedLevel('all');
  };

  // Get unique categories and levels from courses with null checks
  const categories = courses.length > 0 ? [...new Set(courses.map(course => course.category).filter(Boolean))] : [];
  const levels = courses.length > 0 ? [...new Set(courses.map(course => course.level).filter(Boolean))] : [];

  const getLevelColor = (level) => {
    switch (level) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isEnrolled = (course) => {
    return course.isUserEnrolled || (user?.enrolledCourses?.includes(course.id));
  };

  const hasPendingEnrollment = (courseId) => {
    return pendingEnrollments.some(enrollment => 
      enrollment.courseId === courseId && enrollment.studentId === user?.id
    );
  };

  const getCourseRating = (courseId) => {
    const rating = courseRatings[courseId];
    return rating ? {
      average: Math.round(rating.average * 10) / 10,
      count: rating.count
    } : { average: 0, count: 0 };
  };

  const handleDeleteCourse = (courseId) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      // Remove from localStorage
      const storedCourses = JSON.parse(localStorage.getItem('courses') || '[]');
      const updatedCourses = storedCourses.filter(course => course.id !== courseId);
      localStorage.setItem('courses', JSON.stringify(updatedCourses));
      
      // Also remove from pending courses if it exists there
      const pendingCourses = JSON.parse(localStorage.getItem('pendingCourses') || '[]');
      const updatedPendingCourses = pendingCourses.filter(course => course.id !== courseId);
      localStorage.setItem('pendingCourses', JSON.stringify(updatedPendingCourses));
      
      // Update state immediately
      setCourses(prev => prev.filter(course => course.id !== courseId));
      
      // Emit event for real-time updates
      eventBus.emit(EVENTS.COURSE_DELETED, { courseId });
      
      toast.success('Course deleted successfully');
    }
  };

  const handleEnrollCourse = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    // Check if already enrolled or has pending request
    if (isEnrolled(course)) {
      toast.info('You are already enrolled in this course');
      return;
    }

    if (hasPendingEnrollment(courseId)) {
      toast.info('Your enrollment request is pending approval');
      return;
    }

    // Create enrollment request
    const enrollmentRequest = {
      id: Date.now(),
      studentId: user?.id,
      studentName: user?.name,
      studentEmail: user?.email,
      studentAvatar: user?.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
      courseId: courseId,
      courseName: course.title,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };

    // Add to pending enrollments
    const pendingEnrollments = JSON.parse(localStorage.getItem('pendingEnrollments') || '[]');
    pendingEnrollments.push(enrollmentRequest);
    localStorage.setItem('pendingEnrollments', JSON.stringify(pendingEnrollments));
    
    setPendingEnrollments(pendingEnrollments);
    
    // Emit event for real-time updates
    eventBus.emit(EVENTS.ENROLLMENT_REQUESTED, enrollmentRequest);
    
    toast.success('Enrollment request submitted! Waiting for admin approval.');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            {user?.role === 'instructor' ? 'My Courses' : 'Available Courses'}
          </h1>
          <p className="text-secondary-600 mt-1">
            {user?.role === 'instructor' 
              ? 'Manage and track your teaching courses'
              : 'Discover and enroll in courses to advance your learning'
            }
          </p>
        </div>
        
        {user?.role === 'instructor' && (
          <Link
            to="/create-course"
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Course</span>
          </Link>
        )}
      </div>

      {/* Statistics for Instructors */}
      {user?.role === 'instructor' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-secondary-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-secondary-600">My Courses</p>
                <p className="text-2xl font-bold text-secondary-900">{courses.length}</p>
                <p className="text-xs text-secondary-500">Courses you created</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-secondary-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-secondary-600">My Students</p>
                <p className="text-2xl font-bold text-secondary-900">
                  {courses.reduce((sum, course) => sum + (course.enrolledStudents || 0), 0)}
                </p>
                <p className="text-xs text-secondary-500">Students in your courses</p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-secondary-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-secondary-600">Active Courses</p>
                <p className="text-2xl font-bold text-secondary-900">
                  {courses.filter(course => course.status === 'active').length}
                </p>
                <p className="text-xs text-secondary-500">Currently running</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-secondary-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-secondary-600">Avg Rating</p>
                <p className="text-2xl font-bold text-secondary-900">
                  {courses.length > 0 && Object.keys(courseRatings).length > 0
                    ? (Object.entries(courseRatings)
                        .filter(([courseId]) => courses.some(c => c.id === parseInt(courseId)))
                        .reduce((sum, [, rating]) => sum + (rating.average || 0), 0) / 
                       Object.entries(courseRatings)
                        .filter(([courseId]) => courses.some(c => c.id === parseInt(courseId)))
                        .length || 0).toFixed(1)
                    : '0.0'
                  }
                </p>
                <p className="text-xs text-secondary-500">From student reviews</p>
              </div>
              <Star className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>
      )}

      {/* FIXED: Enhanced Filters Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-secondary-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* FIXED: Enhanced Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-10 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
                title="Clear search"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 h-4 w-4" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full px-4 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
          >
            <option value="all">All Levels</option>
            {levels.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>

          {/* Results Count and Clear Button */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary-600">
              {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found
            </span>
            {(searchTerm || selectedCategory !== 'all' || selectedLevel !== 'all') && (
              <button
                onClick={handleClearSearch}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) => {
          const rating = getCourseRating(course.id);
          const isPendingEnrollment = hasPendingEnrollment(course.id);
          const userEnrolled = isEnrolled(course);
          
          return (
            <div key={course.id} className="bg-white rounded-xl shadow-sm border border-secondary-200 overflow-hidden card-hover">
              <div className="relative">
                <img
                  src={course.image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1470&q=80'}
                  alt={course.title}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-4 left-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(course.level)}`}>
                    {course.level}
                  </span>
                </div>
                {user?.role === 'student' && userEnrolled && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-primary-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Enrolled
                    </span>
                  </div>
                )}
                {user?.role === 'student' && isPendingEnrollment && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-yellow-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Pending
                    </span>
                  </div>
                )}
                {user?.role === 'instructor' && course.createdAt && new Date(course.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                      New
                    </span>
                  </div>
                )}
              </div>

              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5 text-primary-600" />
                    {course.status && course.status !== 'active' && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        course.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        course.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {course.status === 'pending' ? 'Pending Approval' :
                         course.status === 'rejected' ? 'Rejected' :
                         course.status}
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(course.level)}`}>
                    {course.level}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-secondary-900 line-clamp-2 mb-2">
                  {course.title}
                </h3>

                <p className="text-secondary-600 text-sm mb-4 line-clamp-2">
                  {course.description}
                </p>

                <div className="flex items-center space-x-4 mb-4 text-sm text-secondary-500">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    <span>{course.instructor}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{course.duration}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4 text-sm text-secondary-500">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      <span>{course.enrolledStudents || 0}/{course.maxStudents || 0}</span>
                    </div>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 mr-1 text-yellow-500" />
                      <span>{rating.average} ({rating.count})</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar for enrolled students */}
                {user?.role === 'student' && userEnrolled && course.progress !== undefined && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-secondary-600 mb-1">
                      <span>Progress</span>
                      <span>{course.progress}%</span>
                    </div>
                    <div className="w-full bg-secondary-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary-500">{course.category}</span>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {user?.role === 'instructor' ? (
                      <>
                        <Link
                          to={`/courses/${course.id}`}
                          className="p-2 text-primary-600 hover:text-primary-700 rounded-lg hover:bg-primary-50"
                          title="View Course"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {course.status === 'active' && (
                          <Link
                            to={`/courses/${course.id}/edit`}
                            className="p-2 text-secondary-600 hover:text-secondary-700 rounded-lg hover:bg-secondary-50"
                            title="Edit Course"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        )}
                        <button
                          onClick={() => handleDeleteCourse(course.id)}
                          className="p-2 text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50"
                          title="Delete Course"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {!userEnrolled && !isPendingEnrollment && course.status === 'active' && (
                          <button
                            onClick={() => handleEnrollCourse(course.id)}
                            className="btn-primary text-sm px-3 py-1"
                          >
                            Request Enrollment
                          </button>
                        )}
                        {isPendingEnrollment && (
                          <span className="text-xs text-yellow-600 font-medium">
                            Approval Pending
                          </span>
                        )}
                        <Link
                          to={`/courses/${course.id}`}
                          className="flex items-center text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >
                          View Details
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* No Results Message */}
      {filteredCourses.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">
            {searchTerm || selectedCategory !== 'all' || selectedLevel !== 'all'
              ? 'No courses match your search criteria'
              : (user?.role === 'instructor' ? 'No courses created yet' : 'No courses found')
            }
          </h3>
          <p className="text-secondary-600 mb-4">
            {searchTerm || selectedCategory !== 'all' || selectedLevel !== 'all'
              ? 'Try adjusting your search terms or filters to find courses.'
              : (user?.role === 'instructor' 
                ? 'Create your first course to start teaching students.'
                : 'Try adjusting your search criteria or filters to find courses.')
            }
          </p>
          {(searchTerm || selectedCategory !== 'all' || selectedLevel !== 'all') && (
            <button
              onClick={handleClearSearch}
              className="btn-primary"
            >
              Clear Search
            </button>
          )}
          {user?.role === 'instructor' && !searchTerm && selectedCategory === 'all' && selectedLevel === 'all' && (
            <Link
              to="/create-course"
              className="btn-primary inline-block"
            >
              Create Your First Course
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseList;
