export type User = {
  id: string;
  name: string;
  surname: string;
  picture_url: string | null;
  role: "admin" | "member";
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "created_at" | "updated_at">;
        Update: Partial<Omit<User, "id" | "created_at" | "updated_at">>;
      };
    };
    Functions: {
      is_admin: (user_id: string) => boolean;
    };
  };
};
