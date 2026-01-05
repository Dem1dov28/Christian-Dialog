import {
  MdStar,
  MdNotifications,
  MdWork,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdPsychology,
  MdAutoAwesome,
  MdGroup,
  MdGroups,
  MdDiversity3,
  MdPeopleAlt,
  MdEmojiPeople,
  MdConnectWithoutContact,
  MdInterpreterMode,
  MdChat,
  MdTheaterComedy,
  MdStarBorder,
  MdLocalFireDepartment,
  MdDiamond,
} from "react-icons/md";
import { PiHandsClappingDuotone } from "react-icons/pi";
import { TbUserCog } from "react-icons/tb";
import { FaPeopleGroup } from "react-icons/fa6";
import { RiTeamFill } from "react-icons/ri";

/**
 * Функция для получения React Icon компонента по имени
 * @param {string} iconName - Имя иконки
 * @returns {React.Component} - React компонент иконки
 */
export function getIconComponent(iconName) {
  const iconMap = {
    star: MdStar,
    notifications: MdNotifications,
    work: MdWork,
    calculate: MdCalculate,
    translate: MdTranslate,
    wb_sunny: MdWbSunny,
    psychology: MdPsychology,
    auto_awesome: MdAutoAwesome,
    // Иконки для групповых чатов
    group: MdGroup,
    groups: MdGroups,
    group_add: PiHandsClappingDuotone,
    group_work: TbUserCog,
    diversity: MdDiversity3,
    people_alt: MdPeopleAlt,
    emoji_people: MdEmojiPeople,
    connect: MdConnectWithoutContact,
    interpreter: MdInterpreterMode,
    chat: MdChat,
    comedy: MdTheaterComedy,
    star_border: MdStarBorder,
    fire: MdLocalFireDepartment,
    diamond: MdDiamond,
    fa_people_group: FaPeopleGroup,
    team_fill: RiTeamFill,
  };
  return iconMap[iconName] || MdStar; // По умолчанию звезда
}



