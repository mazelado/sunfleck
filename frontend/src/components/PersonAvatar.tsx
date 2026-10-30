import { Avatar, type MantineSize } from "@mantine/core";
import { IconUser } from "@tabler/icons-react";

interface PersonAvatarProps {
  /** The person's profile picture, if they have one. */
  url: string | null | undefined;
  size?: MantineSize | number;
}

/**
 * A person's profile picture, or a person icon without one. Decorative: the person's name is
 * always shown or spoken next to it (an image here would repeat it, and initials would be
 * text that isn't in the name of the button around it).
 */
export function PersonAvatar({ url, size = "sm" }: PersonAvatarProps) {
  const iconSize = typeof size === "number" ? Math.round(size * 0.55) : 16;
  return (
    <Avatar src={url ?? null} alt="" color="leaf" size={size} aria-hidden>
      <IconUser size={iconSize} />
    </Avatar>
  );
}
