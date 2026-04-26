import heapq
import itertools
import logging
import math
import random
from typing import Dict, List, Sequence, Tuple

from apps.accounts.models import HungerScore
from apps.donations.models import DonationCard
from apps.organizations.models import Organization
from services.geo import haversine_km
from services.geocoding import GeocodingError, geocode_address


logger = logging.getLogger(__name__)

TIE_DISTANCE_FACTOR = 1.2
MAX_ASTAR_DONATIONS = 12
MAX_EXACT_PARETO_DONATIONS = 8
DEFAULT_PARETO_SAMPLE_SIZE = 2500


def _resolve_receiver_for_donation(donation: DonationCard):
    mission = donation.missions.select_related('receiver_organization').order_by('-created_at').first()
    if mission and mission.receiver_organization_id:
        return mission.receiver_organization

    suggestion = donation.suggestions.select_related('ngo').order_by('distance_km').first()
    if suggestion:
        return suggestion.ngo
    return None


def _resolve_hunger_score_for_receiver(receiver_org: Organization) -> float:
    if not receiver_org:
        return 0.0

    hunger_score = (
        HungerScore.objects.filter(receiver_profile__user__organization_memberships__organization=receiver_org)
        .order_by('-current_hunger_score')
        .first()
    )
    return float(hunger_score.current_hunger_score) if hunger_score else 0.0


def _resolve_pickup_coordinates(donation: DonationCard) -> Tuple[float, float]:
    latitude = float(donation.pickup_latitude)
    longitude = float(donation.pickup_longitude)

    if abs(latitude) > 0.000001 or abs(longitude) > 0.000001:
        return latitude, longitude

    return geocode_address(donation.pickup_address)


def build_routing_candidates(donations: List[DonationCard]):
    candidates = []
    skipped = []

    for donation in donations:
        try:
            latitude, longitude = _resolve_pickup_coordinates(donation)
        except GeocodingError as exc:
            skipped.append({'donation_id': str(donation.id), 'reason': str(exc)})
            continue

        receiver_org = _resolve_receiver_for_donation(donation)
        hunger_score = _resolve_hunger_score_for_receiver(receiver_org)
        candidates.append(
            {
                'donation': donation,
                'latitude': latitude,
                'longitude': longitude,
                'hunger_score': hunger_score,
                'receiver_name': receiver_org.name if receiver_org else None,
            }
        )

    return candidates, skipped


def _distance_between_points(from_coords: Tuple[float, float], to_coords: Tuple[float, float]) -> float:
    return haversine_km(from_coords[0], from_coords[1], to_coords[0], to_coords[1])


def _compute_distance_matrices(start_coords: Tuple[float, float], candidates: Sequence[dict]):
    count = len(candidates)
    dist_start = [0.0] * count
    dist_matrix = [[0.0 for _ in range(count)] for _ in range(count)]

    for index, candidate in enumerate(candidates):
        dist_start[index] = _distance_between_points(
            start_coords,
            (candidate['latitude'], candidate['longitude']),
        )

    for left in range(count):
        for right in range(left + 1, count):
            distance = _distance_between_points(
                (candidates[left]['latitude'], candidates[left]['longitude']),
                (candidates[right]['latitude'], candidates[right]['longitude']),
            )
            dist_matrix[left][right] = distance
            dist_matrix[right][left] = distance

    return dist_start, dist_matrix


def _total_distance_for_order(
    order_indices: Sequence[int],
    dist_start: Sequence[float],
    dist_matrix: Sequence[Sequence[float]],
) -> float:
    if not order_indices:
        return 0.0

    total_distance = dist_start[order_indices[0]]
    for index in range(1, len(order_indices)):
        previous = order_indices[index - 1]
        current = order_indices[index]
        total_distance += dist_matrix[previous][current]
    return total_distance


def _total_hunger_for_order(order_indices: Sequence[int], candidates: Sequence[dict]) -> float:
    return float(sum(candidates[index]['hunger_score'] for index in order_indices))


def _format_route_steps(
    order_indices: Sequence[int],
    candidates: Sequence[dict],
    dist_start: Sequence[float],
    dist_matrix: Sequence[Sequence[float]],
):
    route_steps = []
    running_total = 0.0

    for index, candidate_index in enumerate(order_indices):
        candidate = candidates[candidate_index]
        if index == 0:
            segment_distance = dist_start[candidate_index]
        else:
            previous = order_indices[index - 1]
            segment_distance = dist_matrix[previous][candidate_index]
        running_total += segment_distance

        route_steps.append(
            {
                'donation_id': str(candidate['donation'].id),
                'food_title': candidate['donation'].food_title,
                'distance_from_previous_km': round(segment_distance, 3),
                'cumulative_distance_km': round(running_total, 3),
                'hunger_score': round(candidate['hunger_score'], 3),
                'receiver_name': candidate['receiver_name'],
            }
        )

    return route_steps


def serialize_route_result(
    algorithm: str,
    start_coords: Tuple[float, float],
    candidates: Sequence[dict],
    order_indices: Sequence[int],
    objective_cost: float = None,
):
    dist_start, dist_matrix = _compute_distance_matrices(start_coords, candidates)
    total_distance = _total_distance_for_order(order_indices, dist_start, dist_matrix)
    total_hunger = _total_hunger_for_order(order_indices, candidates)

    return {
        'algorithm': algorithm,
        'ordered_donation_ids': [str(candidates[index]['donation'].id) for index in order_indices],
        'total_distance_km': round(total_distance, 3),
        'total_hunger_score': round(total_hunger, 3),
        'objective_cost': round(objective_cost, 3) if objective_cost is not None else None,
        'route_steps': _format_route_steps(order_indices, candidates, dist_start, dist_matrix),
    }


def _nearest_neighbor_order(start_coords: Tuple[float, float], candidates: Sequence[dict]):
    remaining = set(range(len(candidates)))
    current_coords = start_coords
    order = []

    while remaining:
        scored = []
        for index in remaining:
            candidate = candidates[index]
            distance = _distance_between_points(current_coords, (candidate['latitude'], candidate['longitude']))
            scored.append((index, distance, candidate['hunger_score']))
            logger.debug(
                'Route candidate donation=%s distance_km=%.3f hunger_score=%.3f from=(%.6f, %.6f)',
                candidate['donation'].id,
                distance,
                candidate['hunger_score'],
                current_coords[0],
                current_coords[1],
            )
        scored.sort(key=lambda item: item[1])
        chosen_index, chosen_distance, chosen_hunger = scored[0]

        if len(scored) > 1:
            second_index, second_distance, second_hunger = scored[1]
            close_enough = second_distance <= (chosen_distance * TIE_DISTANCE_FACTOR)
            if chosen_distance == 0:
                close_enough = second_distance <= 0.2
            if close_enough and second_hunger > chosen_hunger:
                logger.debug(
                    'Tie-break by hunger selected donation=%s over donation=%s',
                    candidates[second_index]['donation'].id,
                    candidates[chosen_index]['donation'].id,
                )
                chosen_index = second_index

        chosen = candidates[chosen_index]
        order.append(chosen_index)
        current_coords = (chosen['latitude'], chosen['longitude'])
        remaining.remove(chosen_index)

    return order


def optimize_pickup_route(start_latitude: float, start_longitude: float, candidates: List[dict]):
    start_coords = (float(start_latitude), float(start_longitude))
    order_indices = _nearest_neighbor_order(start_coords, candidates)
    result = serialize_route_result('nearest_neighbor', start_coords, candidates, order_indices)
    legacy_steps = [
        {
            'donation_id': step['donation_id'],
            'food_title': step['food_title'],
            'distance_km': step['distance_from_previous_km'],
            'hunger_score': step['hunger_score'],
            'receiver_name': step['receiver_name'],
        }
        for step in result['route_steps']
    ]
    return result['ordered_donation_ids'], legacy_steps


def _indices_from_mask(mask: int, count: int):
    return [index for index in range(count) if mask & (1 << index)]


def _mst_weight_for_mask(mask: int, dist_matrix: Sequence[Sequence[float]], count: int, cache: Dict[int, float]):
    if mask in cache:
        return cache[mask]

    nodes = _indices_from_mask(mask, count)
    if len(nodes) <= 1:
        cache[mask] = 0.0
        return 0.0

    visited = {nodes[0]}
    total = 0.0
    while len(visited) < len(nodes):
        minimum = float('inf')
        minimum_node = None
        for left in visited:
            for right in nodes:
                if right in visited:
                    continue
                weight = dist_matrix[left][right]
                if weight < minimum:
                    minimum = weight
                    minimum_node = right
        total += minimum
        visited.add(minimum_node)

    cache[mask] = total
    return total


def astar_route(start_coords: Tuple[float, float], donation_list: Sequence[dict]):
    count = len(donation_list)
    if count == 0:
        return [], 0.0
    if count > MAX_ASTAR_DONATIONS:
        raise ValueError(
            f'A* route search supports up to {MAX_ASTAR_DONATIONS} donations for practical runtime. '
            f'Received {count}.'
        )

    dist_start, dist_matrix = _compute_distance_matrices(start_coords, donation_list)
    full_mask = (1 << count) - 1
    start_index = count

    mst_cache = {}
    heuristic_cache = {}

    def distance_from_node(node_index: int, donation_index: int):
        if node_index == start_index:
            return dist_start[donation_index]
        return dist_matrix[node_index][donation_index]

    def heuristic(node_index: int, mask: int):
        key = (node_index, mask)
        if key in heuristic_cache:
            return heuristic_cache[key]
        if mask == 0:
            heuristic_cache[key] = 0.0
            return 0.0

        remaining = _indices_from_mask(mask, count)
        minimum_to_remaining = min(distance_from_node(node_index, idx) for idx in remaining)
        mst_weight = _mst_weight_for_mask(mask, dist_matrix, count, mst_cache)
        estimate = minimum_to_remaining + mst_weight
        heuristic_cache[key] = estimate
        return estimate

    open_heap = [(heuristic(start_index, full_mask), 0.0, start_index, full_mask, tuple())]
    best_cost = {(start_index, full_mask): 0.0}

    while open_heap:
        _, current_cost, current_index, mask, path = heapq.heappop(open_heap)
        state = (current_index, mask)
        if current_cost > best_cost.get(state, float('inf')) + 1e-9:
            continue

        if mask == 0:
            return list(path), current_cost

        for next_index in _indices_from_mask(mask, count):
            step_cost = distance_from_node(current_index, next_index)
            next_cost = current_cost + step_cost
            next_mask = mask & ~(1 << next_index)
            next_state = (next_index, next_mask)

            if next_cost + 1e-9 < best_cost.get(next_state, float('inf')):
                best_cost[next_state] = next_cost
                next_path = path + (next_index,)
                priority = next_cost + heuristic(next_index, next_mask)
                heapq.heappush(open_heap, (priority, next_cost, next_index, next_mask, next_path))

    raise ValueError('A* route search failed to produce a route.')


def _pareto_dominates(left: dict, right: dict):
    left_better_or_equal = (
        left['total_distance_km'] <= right['total_distance_km']
        and left['total_hunger_score'] >= right['total_hunger_score']
    )
    one_strict = (
        left['total_distance_km'] < right['total_distance_km']
        or left['total_hunger_score'] > right['total_hunger_score']
    )
    return left_better_or_equal and one_strict


def pareto_routes(start_coords: Tuple[float, float], donation_list: Sequence[dict]):
    count = len(donation_list)
    if count == 0:
        return []

    dist_start, dist_matrix = _compute_distance_matrices(start_coords, donation_list)

    candidate_orders = []
    if count <= MAX_EXACT_PARETO_DONATIONS:
        candidate_orders = [list(order) for order in itertools.permutations(range(count))]
    else:
        sample_size = max(DEFAULT_PARETO_SAMPLE_SIZE, count * 400)
        seen = set()

        nearest_neighbor = tuple(_nearest_neighbor_order(start_coords, donation_list))
        hunger_first = tuple(
            sorted(
                range(count),
                key=lambda idx: donation_list[idx]['hunger_score'],
                reverse=True,
            )
        )
        for seed_route in [nearest_neighbor, hunger_first]:
            if seed_route not in seen:
                candidate_orders.append(list(seed_route))
                seen.add(seed_route)

        for _ in range(sample_size):
            route = list(range(count))
            random.shuffle(route)
            route_key = tuple(route)
            if route_key in seen:
                continue
            candidate_orders.append(route)
            seen.add(route_key)

    frontier = []
    for route in candidate_orders:
        route_metrics = {
            'order_indices': route,
            'total_distance_km': _total_distance_for_order(route, dist_start, dist_matrix),
            'total_hunger_score': _total_hunger_for_order(route, donation_list),
        }

        dominated = False
        survivors = []
        for existing in frontier:
            if _pareto_dominates(existing, route_metrics):
                dominated = True
                break
            if _pareto_dominates(route_metrics, existing):
                continue
            survivors.append(existing)

        if not dominated:
            survivors.append(route_metrics)
            frontier = survivors

    frontier.sort(key=lambda item: (item['total_distance_km'], -item['total_hunger_score']))
    return frontier[:5]


def simulated_annealing_route(
    start_coords: Tuple[float, float],
    donation_list: Sequence[dict],
    initial_temperature: float = 1000.0,
    cooling_rate: float = 0.995,
    minimum_temperature: float = 0.01,
    iterations_per_temperature: int = 100,
):
    count = len(donation_list)
    if count == 0:
        return [], 0.0, 0.0

    dist_start, dist_matrix = _compute_distance_matrices(start_coords, donation_list)

    current_order = list(range(count))
    random.shuffle(current_order)

    def objective(order_indices: Sequence[int]):
        total_distance = _total_distance_for_order(order_indices, dist_start, dist_matrix)
        total_hunger = _total_hunger_for_order(order_indices, donation_list)
        score = total_distance - (total_hunger * 0.1)
        return score, total_distance, total_hunger

    current_objective, current_distance, _ = objective(current_order)
    best_order = current_order[:]
    best_objective = current_objective
    best_distance = current_distance

    temperature = initial_temperature
    while temperature > minimum_temperature:
        for _ in range(iterations_per_temperature):
            if count < 2:
                break

            left, right = random.sample(range(count), 2)
            neighbor_order = current_order[:]
            neighbor_order[left], neighbor_order[right] = neighbor_order[right], neighbor_order[left]

            neighbor_objective, neighbor_distance, _ = objective(neighbor_order)
            delta = neighbor_objective - current_objective

            if delta < 0 or random.random() < math.exp(-delta / temperature):
                current_order = neighbor_order
                current_objective = neighbor_objective

                if current_objective < best_objective:
                    best_objective = current_objective
                    best_order = current_order[:]
                    best_distance = neighbor_distance

        temperature *= cooling_rate

    return best_order, best_distance, best_objective
