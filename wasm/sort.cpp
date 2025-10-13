#include <stdint.h>
#include <algorithm>
#include <vector>

extern "C" {
  // Bubble sort
  void bubble_sort(int32_t* arr, int32_t len) {
    for (int i = 0; i < len - 1; i++) {
      for (int j = 0; j < len - i - 1; j++) {
        if (arr[j] > arr[j + 1]) {
          int temp = arr[j];
          arr[j] = arr[j + 1];
          arr[j + 1] = temp;
        }
      }
    }
  }

  // Quick sort helper
  int partition(int32_t* arr, int low, int high) {
    int pivot = arr[high];
    int i = low - 1;
    
    for (int j = low; j < high; j++) {
      if (arr[j] < pivot) {
        i++;
        int temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
      }
    }
    
    int temp = arr[i + 1];
    arr[i + 1] = arr[high];
    arr[high] = temp;
    return i + 1;
  }

  void quick_sort_impl(int32_t* arr, int low, int high) {
    if (low < high) {
      int pi = partition(arr, low, high);
      quick_sort_impl(arr, low, pi - 1);
      quick_sort_impl(arr, pi + 1, high);
    }
  }

  // Quick sort
  void quick_sort(int32_t* arr, int32_t len) {
    if (len > 1) {
      quick_sort_impl(arr, 0, len - 1);
    }
  }

  // Binary search (requires sorted array)
  int32_t binary_search(int32_t* arr, int32_t len, int32_t target) {
    int left = 0, right = len - 1;
    
    while (left <= right) {
      int mid = left + (right - left) / 2;
      
      if (arr[mid] == target) return mid;
      if (arr[mid] < target) left = mid + 1;
      else right = mid - 1;
    }
    
    return -1; // Not found
  }

  // Find minimum
  int32_t find_min(int32_t* arr, int32_t len) {
    if (len == 0) return 0;
    int32_t min = arr[0];
    for (int i = 1; i < len; i++) {
      if (arr[i] < min) min = arr[i];
    }
    return min;
  }

  // Find maximum
  int32_t find_max(int32_t* arr, int32_t len) {
    if (len == 0) return 0;
    int32_t max = arr[0];
    for (int i = 1; i < len; i++) {
      if (arr[i] > max) max = arr[i];
    }
    return max;
  }

  // Calculate average
  double calculate_average(int32_t* arr, int32_t len) {
    if (len == 0) return 0.0;
    int64_t sum = 0;
    for (int i = 0; i < len; i++) {
      sum += arr[i];
    }
    return (double)sum / len;
  }
}
