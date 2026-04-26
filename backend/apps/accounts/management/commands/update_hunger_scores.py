from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import ReceiverProfile
from services.hunger import update_all_hunger_scores, update_receiver_hunger_score


class Command(BaseCommand):
    help = 'Recalculate hunger scores for all receivers, or one receiver by user id.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--receiver-id',
            dest='receiver_id',
            help='Receiver user UUID. If provided, only this receiver score is recalculated.',
        )

    def handle(self, *args, **options):
        receiver_id = options.get('receiver_id')

        if receiver_id:
            receiver_profile = ReceiverProfile.objects.select_related('user').filter(user_id=receiver_id).first()
            if not receiver_profile:
                raise CommandError(f'Receiver with user id "{receiver_id}" was not found.')

            hunger_score, last_delivery = update_receiver_hunger_score(receiver_profile)
            last_delivery_text = last_delivery.updated_at.isoformat() if last_delivery else 'none'
            self.stdout.write(
                self.style.SUCCESS(
                    f'Updated receiver={receiver_profile.user.username} '
                    f'score={hunger_score.current_hunger_score:.4f} '
                    f'hours_waiting={hunger_score.hours_since_last_delivery:.2f} '
                    f'last_delivery={last_delivery_text}'
                )
            )
            return

        updates = update_all_hunger_scores()
        self.stdout.write(self.style.SUCCESS(f'Updated hunger scores for {len(updates)} receiver(s).'))
        for item in updates:
            self.stdout.write(
                f"- {item['receiver_username']} | score={item['score']:.4f} | "
                f"hours={item['hours_waiting']:.2f} | last_delivery={item['last_delivery_at'] or 'none'}"
            )
