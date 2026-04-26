from django.contrib import admin

from apps.accounts.models import HungerScore, ReceiverProfile, User, VolunteerProfile
from services.hunger import update_receiver_hunger_score


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'profile_visibility', 'is_verified_actor')
    list_filter = ('role', 'profile_visibility', 'is_verified_actor')
    search_fields = ('username', 'email', 'first_name', 'last_name')


@admin.register(VolunteerProfile)
class VolunteerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'availability', 'vehicle_type', 'karma_points')
    list_filter = ('availability', 'vehicle_type')
    search_fields = ('user__username',)


@admin.register(ReceiverProfile)
class ReceiverProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'household_size', 'created_at', 'updated_at')
    search_fields = ('user__username', 'user__email')
    actions = ('recalculate_hunger_score',)

    @admin.action(description='Recalculate hunger score for selected receivers')
    def recalculate_hunger_score(self, request, queryset):
        updated = 0
        for receiver_profile in queryset.select_related('user'):
            update_receiver_hunger_score(receiver_profile)
            updated += 1
        self.message_user(request, f'Recalculated hunger score for {updated} receiver(s).')


@admin.register(HungerScore)
class HungerScoreAdmin(admin.ModelAdmin):
    list_display = (
        'receiver_profile',
        'current_hunger_score',
        'hours_since_last_delivery',
        'household_size',
        'last_calculated_at',
    )
    search_fields = ('receiver_profile__user__username',)
