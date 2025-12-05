import json
import boto3
import logging
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from collections import defaultdict
from statistics import mean

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
HISTORY_TABLE_NAME = os.getenv('HISTORY_TABLE', 'parking-history')
CURRENT_TABLE_NAME = os.getenv('CURRENT_TABLE', 'parking-spaces-dev')
history_table = dynamodb.Table(HISTORY_TABLE_NAME)
current_table = dynamodb.Table(CURRENT_TABLE_NAME)

class DecimalEncoder(json.JSONEncoder):
    """Encoder personalizado para manejar objetos Decimal de DynamoDB"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


# ============================================================================
# LEVEL 1: REAL-TIME OPERATIONAL METRICS
# ============================================================================

def get_current_occupancy_rate(items=None):
    """
    KPI 1: Current Occupancy Rate (%)
    Formula: (Occupied Spaces / Total Spaces) × 100
    Source: Current table (parking-spaces-dev)
    """
    try:
        if items is None:
            response = current_table.scan(
                ProjectionExpression='space_id, #st, #ts',
                ExpressionAttributeNames={'#st': 'status', '#ts': 'timestamp'}
            )
            items = response.get('Items', [])
        
        total_spaces = len(items)
        
        if total_spaces == 0:
            return {
                'occupancy_rate': 0.0,
                'total_spaces': 0,
                'occupied_spaces': 0,
                'available_spaces': 0,
                'status': 'NO_DATA'
            }

        # Count occupied spaces based on last known status (trusting DB state)
        occupied_spaces = sum(1 for item in items if item.get('status') == 'occupied')

        vacant_spaces = total_spaces - occupied_spaces
        occupancy_rate = (occupied_spaces / total_spaces) * 100
        
        # Determine status according to document target ranges
        if occupancy_rate < 40:
            status = 'UNDERUTILIZED'
        elif 60 <= occupancy_rate <= 85:
            status = 'OPTIMAL'
        elif occupancy_rate > 90:
            status = 'CRITICAL'
        else:
            status = 'NORMAL'
        
        logger.info(f"Occupancy Rate: {occupancy_rate:.2f}% ({occupied_spaces}/{total_spaces}) - Status: {status}")
        
        return {
            'occupancy_rate': round(occupancy_rate, 2),
            'total_spaces': total_spaces,
            'occupied_spaces': occupied_spaces,
            'vacant_spaces': vacant_spaces,
            'status': status,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error calculating occupancy rate: {str(e)}")
        return {'error': str(e)}


def get_available_spaces_by_zone(items=None):
    """
    KPI 2: Number of Available Spaces
    Formula: Total Spaces - Occupied Spaces
    Broken down by zone and facility for better granularity
    Color code: Green >20, Yellow 5-20, Red <5
    Status: 'vacant' indicates available space
    """
    try:
        if items is None:
            response = current_table.scan(
                ProjectionExpression='space_id, #st, zone_id, facility_id, #ts',
                ExpressionAttributeNames={'#st': 'status', '#ts': 'timestamp'}
            )
            items = response.get('Items', [])
        
        # We count available spaces based on last known status 'vacant'
        vacant_items = [item for item in items if item.get('status') == 'vacant']
        
        total_vacant = len(vacant_items)
        
        # Group by area and facility
        zones = defaultdict(int)
        facilities = defaultdict(int)
        
        for item in vacant_items:
            zone = item.get('zone_id', 'UNKNOWN')
            facility = item.get('facility_id', 'UNKNOWN')
            zones[zone] += 1
            facilities[facility] += 1
        
        # Color coding according to document
        if total_vacant > 20:
            color_code = 'GREEN'
        elif 5 <= total_vacant <= 20:
            color_code = 'YELLOW'
        else:
            color_code = 'RED'
        
        logger.info(f"Vacant Spaces: {total_vacant} - Color: {color_code}")
        
        return {
            'total_vacant': total_vacant,
            'color_code': color_code,
            'by_zone': dict(zones),
            'by_facility': dict(facilities),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error getting available spaces: {str(e)}")
        return {'error': str(e)}


def check_critical_capacity_alert(items=None):
    """
    KPI 3: Critical Capacity Alert Status
    Trigger condition: Occupancy rate >= 95%
    Enables proactive response from the operator
    """
    try:
        occupancy_data = get_current_occupancy_rate(items)
        
        if 'error' in occupancy_data:
            return occupancy_data
        
        occupancy_rate = occupancy_data['occupancy_rate']
        alert_active = occupancy_rate >= 95
        
        if alert_active:
            logger.warning(f"CRITICAL CAPACITY ALERT: {occupancy_rate}%")
        
        return {
            'alert_active': alert_active,
            'occupancy_rate': occupancy_rate,
            'threshold': 95.0,
            'severity': 'CRITICAL' if alert_active else 'NORMAL',
            'message': f"Capacidad crítica alcanzada: {occupancy_rate}%" if alert_active else "Capacidad normal",
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error checking critical capacity: {str(e)}")
        return {'error': str(e)}


# ============================================================================
# LEVEL 2: SYSTEM PERFORMANCE AND QUALITY METRICS
# ============================================================================

def get_average_detection_confidence(time_window_minutes=15, items=None):
    """
    KPI 4: Average Detection Confidence
    Formula: Average(confidence_score) of OCCUPIED spaces in last 15 minutes
    Validates accuracy of YOLO11s model (target: mAP50 96.7%)
    Ranges: >85% excellent, 75-85% acceptable, <75% requires investigation
    """
    try:
        now = datetime.now(timezone.utc)
        threshold_time = now - timedelta(minutes=time_window_minutes)
        
        if items is None:
            response = current_table.scan(
                ProjectionExpression='confidence, #ts, #st, space_id',
                ExpressionAttributeNames={'#ts': 'timestamp', '#st': 'status'}
            )
            items = response.get('Items', [])
        
        recent_confidences = []
        debug_stats = {'total': len(items), 'skipped_time': 0, 'skipped_vacant': 0, 'skipped_no_conf': 0, 'occupied_ids': []}
        
        for item in items:
            ts_str = item.get('timestamp')
            confidence = item.get('confidence')
            status = item.get('status')
            space_id = item.get('space_id')
            
            # Only consider occupied spaces for detection confidence
            if status != 'occupied':
                debug_stats['skipped_vacant'] += 1
                continue
            
            debug_stats['occupied_ids'].append(space_id)

            if ts_str and confidence is not None:
                try:
                    ts_str = ts_str.replace('Z', '+00:00')
                    item_time = datetime.fromisoformat(ts_str)
                    
                    if item_time >= threshold_time:
                        recent_confidences.append(float(confidence))
                    else:
                        debug_stats['skipped_time'] += 1
                        logger.debug(f"Stale data for {space_id}: {item_time} < {threshold_time}")
                except ValueError:
                    continue
            else:
                debug_stats['skipped_no_conf'] += 1
                logger.warning(f"Missing data for occupied space {space_id}: ts={ts_str}, conf={confidence}")
        
        logger.info(f"Confidence Stats: {debug_stats} | Samples: {len(recent_confidences)}")

        if not recent_confidences:
            return {
                'average_confidence': 0.0,
                'sample_size': 0,
                'quality_status': 'NO_DATA',
                'time_window_minutes': time_window_minutes,
                'debug_info': debug_stats
            }
        
        avg_confidence = mean(recent_confidences) * 100
        
        # Classification according to document ranks
        if avg_confidence > 85:
            quality_status = 'EXCELLENT'
        elif 75 <= avg_confidence <= 85:
            quality_status = 'ACCEPTABLE'
        else:
            quality_status = 'REQUIRES_INVESTIGATION'
        
        logger.info(f"Avg Confidence: {avg_confidence:.2f}% ({len(recent_confidences)} samples) - {quality_status}")
        
        return {
            'average_confidence': round(avg_confidence, 2),
            'sample_size': len(recent_confidences),
            'quality_status': quality_status,
            'time_window_minutes': time_window_minutes,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error calculating average confidence: {str(e)}")
        return {'error': str(e)}


def get_low_confidence_event_rate(time_window_minutes=15, threshold=0.75, items=None):
    """
    KPI 5: Low Confidence Event Rate
    Formula: (Events with confidence < 0.75 / Total Events) × 100
    Identifies systematic problems (angles, obstructions, weather)
    Ranges: <5% normal, 5-10% monitor, >10% action required
    """
    try:
        now = datetime.now(timezone.utc)
        threshold_time = now - timedelta(minutes=time_window_minutes)
        
        if items is None:
            response = current_table.scan(
                ProjectionExpression='confidence, #ts, space_id',
                ExpressionAttributeNames={'#ts': 'timestamp'}
            )
            items = response.get('Items', [])
        
        total_events = 0
        low_confidence_events = 0
        
        for item in items:
            ts_str = item.get('timestamp')
            confidence = item.get('confidence')
            
            if ts_str and confidence:
                try:
                    ts_str = ts_str.replace('Z', '+00:00')
                    item_time = datetime.fromisoformat(ts_str)
                    
                    if item_time >= threshold_time:
                        total_events += 1
                        if float(confidence) < threshold:
                            low_confidence_events += 1
                except ValueError:
                    continue
        
        if total_events == 0:
            return {
                'low_confidence_rate': 0.0,
                'low_confidence_count': 0,
                'total_events': 0,
                'status': 'NO_DATA'
            }
        
        low_confidence_rate = (low_confidence_events / total_events) * 100
        
        # Classification according to document ranks
        if low_confidence_rate < 5:
            status = 'NORMAL'
        elif 5 <= low_confidence_rate <= 10:
            status = 'MONITOR'
        else:
            status = 'ACTION_REQUIRED'
        
        logger.info(f"Low Confidence Rate: {low_confidence_rate:.2f}% ({low_confidence_events}/{total_events}) - {status}")
        
        return {
            'low_confidence_rate': round(low_confidence_rate, 2),
            'low_confidence_count': low_confidence_events,
            'total_events': total_events,
            'threshold': threshold * 100,
            'status': status,
            'time_window_minutes': time_window_minutes,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error calculating low confidence rate: {str(e)}")
        return {'error': str(e)}


def get_system_health_device_uptime(inactive_threshold_minutes=1, items=None):
    """
    KPI 6: System Uptime / Device Health
    Formula: (Active Devices / Total Devices) × 100
    Active device = posted a message in the last 5 minutes
    Alert threshold: <90% triggers notification
    """
    try:
        now = datetime.now(timezone.utc)
        threshold_time = now - timedelta(minutes=inactive_threshold_minutes)
        
        if items is None:
            response = current_table.scan(
                ProjectionExpression='device_id, #ts, is_alive',
                ExpressionAttributeNames={'#ts': 'timestamp'}
            )
            items = response.get('Items', [])
        
        devices_status = {} # device_id -> {'last_seen': datetime, 'is_alive': bool}
        
        for item in items:
            device_id = item.get('device_id')
            ts_str = item.get('timestamp')
            is_alive = item.get('is_alive', True) # Default to True if missing
            
            if device_id and ts_str:
                try:
                    ts_str = ts_str.replace('Z', '+00:00')
                    item_time = datetime.fromisoformat(ts_str)
                    
                    if device_id not in devices_status:
                        devices_status[device_id] = {'last_seen': item_time, 'is_alive': is_alive}
                    else:
                        if item_time > devices_status[device_id]['last_seen']:
                             devices_status[device_id] = {'last_seen': item_time, 'is_alive': is_alive}
                except ValueError:
                    continue
        
        total_devices = len(devices_status)
        
        if total_devices == 0:
            return {
                'uptime_percentage': 0.0,
                'active_devices': 0,
                'total_devices': 0,
                'inactive_devices': [],
                'status': 'NO_DATA'
            }
        
        active_devices = 0
        inactive_devices = []
        
        for device_id, status in devices_status.items():
            last_seen = status['last_seen']
            is_alive = status['is_alive']
            
            if is_alive and last_seen >= threshold_time:
                active_devices += 1
            else:
                inactive_devices.append(device_id)
        
        uptime_percentage = (active_devices / total_devices) * 100
        
        status = 'HEALTHY' if uptime_percentage >= 90 else 'DEGRADED'
        
        if uptime_percentage < 90:
            logger.warning(f"System Health Degraded: {uptime_percentage:.2f}% uptime - Inactive: {inactive_devices}")
        else:
            logger.info(f"System Health: {uptime_percentage:.2f}% ({active_devices}/{total_devices})")
        
        return {
            'uptime_percentage': round(uptime_percentage, 2),
            'active_devices': active_devices,
            'total_devices': total_devices,
            'inactive_devices': inactive_devices,
            'device_list': [
                {
                    'device_id': d_id,
                    'status': 'active' if d_id not in inactive_devices else 'inactive',
                    'last_seen': stat['last_seen'].isoformat()
                }
                for d_id, stat in devices_status.items()
            ],
            'status': status,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error checking system health: {str(e)}")
        return {'error': str(e)}


def get_message_processing_latency(time_window_minutes=15, items=None):
    """
    KPI 7: Message Processing Latency
    Formula: Average(processed_timestamp - created_timestamp)
    Measures end-to-end system latency
    Target: < 2 seconds for real-time updates
    """
    try:
        now = datetime.now(timezone.utc)
        threshold_time = now - timedelta(minutes=time_window_minutes)
        
        if items is None:
            # Scan current table for recent updates
            response = current_table.scan(
                ProjectionExpression='#ts, #proc_ts',
                ExpressionAttributeNames={
                    '#ts': 'timestamp',
                    '#proc_ts': 'processed_timestamp'
                }
            )
            items = response.get('Items', [])
        
        latencies = []
        
        for item in items:
            created_ts = item.get('timestamp')
            processed_ts = item.get('processed_timestamp')
            
            if created_ts and processed_ts:
                try:
                    created_ts = created_ts.replace('Z', '+00:00')
                    processed_ts = processed_ts.replace('Z', '+00:00')
                    
                    created_time = datetime.fromisoformat(created_ts)
                    processed_time = datetime.fromisoformat(processed_ts)
                    
                    if created_time >= threshold_time:
                        latency = (processed_time - created_time).total_seconds()
                        if latency >= 0:
                            latencies.append(latency)
                except ValueError:
                    continue
        
        if not latencies:
            return {
                'average_latency_seconds': 0.0,
                'sample_size': 0,
                'status': 'NO_DATA'
            }
        
        avg_latency = mean(latencies)
        max_latency = max(latencies)
        
        status = 'EXCELLENT' if avg_latency < 2 else 'ACCEPTABLE' if avg_latency < 5 else 'DEGRADED'
        
        logger.info(f"Msg Latency: {avg_latency:.3f}s (Max: {max_latency:.3f}s) - {status}")
        
        return {
            'average_latency_seconds': round(avg_latency, 3),
            'max_latency_seconds': round(max_latency, 3),
            'sample_size': len(latencies),
            'status': status,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error calculating message latency: {str(e)}")
        return {'error': str(e)}


# ============================================================================
# LEVEL 3: ANALYTICS AND TRENDS
# ============================================================================

def calculate_average_parking_duration(days_back=7, items=None):
    """
    KPI 8: Average Parking Duration
    Formula: Average(exit_timestamp - entry_timestamp)
    Analyzes occupied -> vacant transitions in history table
    Classification: Retail 1-2 hours, Office 6-8 hours, Airport 3-5 days
    """
    try:
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(days=days_back)
        
        if items is None:
            # Scan historical table
            response = history_table.scan(
                ProjectionExpression='space_id, #ts, #st',
                ExpressionAttributeNames={
                    '#ts': 'timestamp',
                    '#st': 'status'
                }
            )
            items = response.get('Items', [])
        
        # Group events by space_id
        space_events = defaultdict(list)
        
        for item in items:
            space_id = item.get('space_id')
            ts_str = item.get('timestamp')
            status = item.get('status')
            
            if space_id and ts_str and status:
                try:
                    ts_str = ts_str.replace('Z', '+00:00')
                    event_time = datetime.fromisoformat(ts_str)
                    
                    if event_time >= start_time:
                        space_events[space_id].append({
                            'timestamp': event_time,
                            'status': status
                        })
                except ValueError:
                    continue
        
        # Calculate full session durations
        durations = []
        
        for space_id, events in space_events.items():
            # Order by timestamp
            events.sort(key=lambda x: x['timestamp'])
            
            entry_time = None
            for event in events:
                if event['status'] == 'occupied' and entry_time is None:
                    entry_time = event['timestamp']
                elif event['status'] == 'vacant' and entry_time is not None:
                    duration = (event['timestamp'] - entry_time).total_seconds() / 3600  # horas
                    durations.append(duration)
                    entry_time = None
        
        if not durations:
            return {
                'average_duration_hours': 0.0,
                'sample_size': 0,
                'usage_type': 'NO_DATA',
                'days_analyzed': days_back
            }
        
        avg_duration = mean(durations)
        
        # Classify type of use according to document
        if avg_duration <= 0.5:
            usage_type = 'QUICK_ERRANDS'
        elif avg_duration <= 2:
            usage_type = 'RETAIL'
        elif avg_duration <= 8:
            usage_type = 'OFFICE_COMMUTERS'
        else:
            usage_type = 'AIRPORT_LONG_TERM'
        
        logger.info(f"Avg Parking Duration: {avg_duration:.2f}h ({len(durations)} sessions) - Type: {usage_type}")
        
        return {
            'average_duration_hours': round(avg_duration, 2),
            'sample_size': len(durations),
            'usage_type': usage_type,
            'days_analyzed': days_back,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error calculating parking duration: {str(e)}")
        return {'error': str(e)}


def get_peak_occupancy_hours(days_back=30, items=None):
    """
    KPI 9: Peak Occupancy Hours
    Adds hourly occupancy % from historical data
    Identifies the top 3-5 hour blocks in a 30-day window
    Enables staffing and dynamic pricing planning
    """
    try:
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(days=days_back)
        
        if items is None:
            response = history_table.scan(
                ProjectionExpression='#ts, #st',
                ExpressionAttributeNames={
                    '#ts': 'timestamp',
                    '#st': 'status'
                }
            )
            items = response.get('Items', [])
        
        # Hourly occupancy counter (0-23)
        hourly_occupancy = defaultdict(lambda: {'occupied': 0, 'total': 0})
        
        for item in items:
            ts_str = item.get('timestamp')
            status = item.get('status')
            
            if ts_str and status:
                try:
                    ts_str = ts_str.replace('Z', '+00:00')
                    event_time = datetime.fromisoformat(ts_str)
                    
                    if event_time >= start_time:
                        hour = event_time.hour
                        hourly_occupancy[hour]['total'] += 1
                        if status == 'occupied':
                            hourly_occupancy[hour]['occupied'] += 1
                except ValueError:
                    continue
        
        # Calculate hourly percentages
        hourly_percentages = {}
        for hour in range(24):
            if hourly_occupancy[hour]['total'] > 0:
                percentage = (hourly_occupancy[hour]['occupied'] / 
                            hourly_occupancy[hour]['total']) * 100
                hourly_percentages[hour] = round(percentage, 2)
            else:
                hourly_percentages[hour] = 0.0
        
        # Identify top 5 peak hours
        sorted_hours = sorted(hourly_percentages.items(), 
                            key=lambda x: x[1], reverse=True)
        peak_hours = sorted_hours[:5]
        
        logger.info(f"Peak Hours: {[f'{h}:00 ({p}%)' for h, p in peak_hours]}")
        
        return {
            'peak_hours': [{'hour': h, 'occupancy_percentage': p} for h, p in peak_hours],
            'days_analyzed': days_back,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error calculating peak hours: {str(e)}")
        return {'error': str(e)}


def get_occupancy_trend(hours_back=24, interval_minutes=60, items=None):
    """
    KPI 10: Occupancy Trend (Time Series)
    Historical visualization of occupancy rates
    Granularity: hourly, daily, or weekly (selectable)
    Identifies patterns, seasonal variations, and trends
    """
    try:
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(hours=hours_back)
        
        if items is None:
            response = history_table.scan(
                ProjectionExpression='space_id, #ts, #st',
                ExpressionAttributeNames={'#ts': 'timestamp', '#st': 'status'}
            )
            items = response.get('Items', [])
        
        # Create time intervals
        time_slots = []
        current_time = start_time
        while current_time <= now:
            time_slots.append(current_time)
            current_time += timedelta(minutes=interval_minutes)
        
        # Calculate occupancy by interval
        trend_data = []
        
        for slot_time in time_slots:
            slot_end = slot_time + timedelta(minutes=interval_minutes)
            
            occupied_count = 0
            total_count = 0
            
            for item in items:
                ts_str = item.get('timestamp')
                status = item.get('status')
                
                if ts_str and status:
                    try:
                        ts_str = ts_str.replace('Z', '+00:00')
                        event_time = datetime.fromisoformat(ts_str)
                        
                        if slot_time <= event_time < slot_end:
                            total_count += 1
                            if status == 'occupied':
                                occupied_count += 1
                    except ValueError:
                        continue
            
            occupancy_rate = (occupied_count / total_count * 100) if total_count > 0 else 0.0
            
            trend_data.append({
                'timestamp': slot_time.isoformat(),
                'occupancy_rate': round(occupancy_rate, 2),
                'occupied_count': occupied_count,
                'sample_size': total_count
            })
        
        logger.info(f"Occupancy Trend: {len(trend_data)} data points over {hours_back}h")
        
        return {
            'trend_data': trend_data,
            'hours_analyzed': hours_back,
            'interval_minutes': interval_minutes,
            'data_points': len(trend_data),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error calculating occupancy trend: {str(e)}")
        return {'error': str(e)}


# ============================================================================
# MAIN HANDLER 
# ============================================================================

def lambda_handler(event, context):
    """
    Main handler for TeraSpot KPIs Lambda
    
    Supports requests for individual KPIs or all at once
    
    Examples of use:
    
    1. Request a specific KPI:
       {"kpi": "occupancy_rate"}
    
    2. KPI with custom parameters:
       {"kpi": "detection_confidence", "params": {"time_window_minutes": 30}}
    
    3. All KPIs (complete dashboard):
       {"kpi": "all"}
    """
    try:
        kpi_requested = event.get('kpi', 'all').lower()
        params = event.get('params', {})
        
        logger.info(f"KPI Request: {kpi_requested} | Params: {params}")
        
        # Mapping available KPIs
        kpi_functions = {
            'occupancy_rate': lambda: get_current_occupancy_rate(),
            'vacant_spaces': lambda: get_available_spaces_by_zone(),
            'critical_capacity': lambda: check_critical_capacity_alert(),
            'detection_confidence': lambda: get_average_detection_confidence(
                params.get('time_window_minutes', 15)
            ),
            'low_confidence_rate': lambda: get_low_confidence_event_rate(
                params.get('time_window_minutes', 15),
                params.get('threshold', 0.75)
            ),
            'system_health': lambda: get_system_health_device_uptime(
                params.get('inactive_threshold_minutes', 5)
            ),
            'message_latency': lambda: get_message_processing_latency(
                params.get('time_window_minutes', 15)
            ),
            'parking_duration': lambda: calculate_average_parking_duration(
                params.get('days_back', 7)
            ),
            'peak_hours': lambda: get_peak_occupancy_hours(
                params.get('days_back', 30)
            ),
            'occupancy_trend': lambda: get_occupancy_trend(
                params.get('hours_back', 24),
                params.get('interval_minutes', 60)
            )
        }
        
        # Process request
        if kpi_requested == 'all':
            # Calculate all KPIs (full dashboard mode)
            logger.info("Calculating ALL KPIs for complete dashboard...")
            
            # Pre-fetch data for optimization
            # 1. Scan current table
            current_response = current_table.scan(
                ProjectionExpression='space_id, #st, #ts, zone_id, facility_id, confidence, device_id, is_alive, #proc_ts',
                ExpressionAttributeNames={
                    '#st': 'status', 
                    '#ts': 'timestamp',
                    '#proc_ts': 'processed_timestamp'
                }
            )
            current_items = current_response.get('Items', [])
            
            # 2. Scan history table (limit to max window needed, e.g. 30 days)
            # For simplicity we scan all, but in production we might want to query with index
            history_response = history_table.scan(
                ProjectionExpression='space_id, #ts, #st',
                ExpressionAttributeNames={
                    '#ts': 'timestamp', 
                    '#st': 'status'
                }
            )
            history_items = history_response.get('Items', [])
            
            results = {
                'level_1_operational': {
                    'occupancy_rate': get_current_occupancy_rate(current_items),
                    'vacant_spaces': get_available_spaces_by_zone(current_items),
                    'critical_capacity': check_critical_capacity_alert(current_items)
                },
                'level_2_performance': {
                    'detection_confidence': get_average_detection_confidence(items=current_items),
                    'low_confidence_rate': get_low_confidence_event_rate(items=current_items),
                    'system_health': get_system_health_device_uptime(items=current_items, inactive_threshold_minutes=1),
                    'message_latency': get_message_processing_latency(items=current_items)
                },
                'level_3_analytics': {
                    'parking_duration': calculate_average_parking_duration(items=history_items),
                    'peak_hours': get_peak_occupancy_hours(items=history_items),
                    'occupancy_trend': get_occupancy_trend(items=history_items)
                },
                'metadata': {
                    'generated_at': datetime.now(timezone.utc).isoformat(),
                    'version': '1.0.0',
                    'project': 'TeraSpot - Smart Parking Management System'
                }
            }
            
            logger.info("All KPIs calculated successfully")
            
        elif kpi_requested in kpi_functions:
            # Calculate specific KPI
            logger.info(f"Calculating specific KPI: {kpi_requested}")
            
            results = {
                'kpi': kpi_requested,
                'data': kpi_functions[kpi_requested](),
                'metadata': {
                    'generated_at': datetime.now(timezone.utc).isoformat(),
                    'params': params
                }
            }
            
            logger.info(f"KPI {kpi_requested} calculated successfully")
            
        else:
            logger.warning(f"Invalid KPI requested: {kpi_requested}")
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                'body': json.dumps({
                    'error': f"Invalid KPI requested: {kpi_requested}",
                    'available_kpis': list(kpi_functions.keys()) + ['all'],
                    'usage': 'Send {"kpi": "kpi_name"} or {"kpi": "all"}'
                }, cls=DecimalEncoder)
            }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            'body': json.dumps(results, cls=DecimalEncoder)
        }
    
    except Exception as e:
        logger.error(f"Lambda execution error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, cls=DecimalEncoder)
        }